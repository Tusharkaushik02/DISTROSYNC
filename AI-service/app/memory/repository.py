"""PostgreSQL-backed conversation memory repository.

Uses asyncpg for non-blocking access to the AI service's PostgreSQL database.
The schema is managed by Prisma migrations; this repository only manages the
runtime connection pool and persistence queries.
"""

import logging
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

from app.core.config import settings

logger = logging.getLogger(__name__)

def _prepare_asyncpg_dsn(database_url: str) -> tuple[str, str | None]:
    """Convert Prisma's DATABASE_URL into an asyncpg-compatible DSN.

    Prisma supports `?schema=ai`, but asyncpg/PostgreSQL does not treat
    `schema` as a valid connection parameter. We remove it from the DSN
    and return it separately so it can be applied through search_path.
    """
    parts = urlsplit(database_url)

    query_params = dict(parse_qsl(parts.query))
    schema = query_params.pop("schema", None)

    dsn = urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query_params),
            parts.fragment,
        )
    )

    return dsn, schema


class MemoryRepository:
    """Low-level persistence layer for conversation messages."""

    def __init__(self, database_url: str | None = None):
        self._database_url = database_url or settings.DATABASE_URL
        self._pool: asyncpg.Pool | None = None

    # ── Lifecycle ──────────────────────────────────────────────────────

    async def initialize(self) -> None:
        """Create the connection pool and verify database connectivity.

        Schema changes belong to Prisma migrations and must not happen during
        application startup. Keeping DDL out of the request service prevents
        multiple replicas from racing to change the database schema.
        """
        try:
            dsn, schema = _prepare_asyncpg_dsn(self._database_url)

            self._pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=2,
                max_size=10,
                server_settings={"search_path": schema} if schema else None,
            )

            await self._pool.fetchval("SELECT 1")

            logger.info("[Memory] PostgreSQL repository initialized")
        except Exception as exc:
            logger.error("[Memory] Failed to initialize PostgreSQL repository: %s", exc)
            await self.close()
            raise

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("[Memory] PostgreSQL connection pool closed")

    # ── Read ───────────────────────────────────────────────────────────

    async def get_history(self, user_id: str, limit: int = 20) -> list[dict]:
        """Return the most recent *limit* messages for a user, oldest-first."""
        if not self._pool:
            raise RuntimeError("MemoryRepository is not initialized.")

        try:
            rows = await self._pool.fetch(
                """
                SELECT message.role, message.content
                FROM conversation_messages AS message
                INNER JOIN conversations AS conversation
                    ON conversation.id = message.conversation_id
                WHERE conversation.user_id = $1
                ORDER BY message.created_at DESC, message.id DESC
                LIMIT $2
                """,
                user_id,
                limit,
            )
            # Reverse so oldest message comes first (chronological order)
            return [
                {"role": row["role"].lower(), "content": row["content"]}
                for row in reversed(rows)
            ]
        except Exception as exc:
            logger.error("[Memory] Failed to fetch history for user %s: %s", user_id, exc)
            raise

    # ── Write ──────────────────────────────────────────────────────────

    async def save_message(self, user_id: str, role: str, content: str) -> None:
        """Persist a single conversation message."""
        if not self._pool:
            raise RuntimeError("MemoryRepository is not initialized.")

        try:
            now = datetime.now(timezone.utc)
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    conversation_id = await conn.fetchval(
                        """
                        INSERT INTO conversations (id, user_id)
                        VALUES ($1, $2)
                        ON CONFLICT (user_id)
                        DO UPDATE SET updated_at = conversations.updated_at
                        RETURNING id
                        """,
                        uuid4(),
                        user_id,
                    )
                    await conn.execute(
                        """
                        INSERT INTO conversation_messages
                            (conversation_id, role, content, created_at)
                        VALUES ($1, $2::\"MessageRole\", $3, $4)
                        """,
                        conversation_id,
                        role.upper(),
                        content,
                        now,
                    )
                    await conn.execute(
                        """
                        UPDATE conversations
                        SET updated_at = $2
                        WHERE id = $1
                        """,
                        conversation_id,
                        now,
                    )
        except Exception as exc:
            logger.error("[Memory] Failed to save message for user %s: %s", user_id, exc)
            raise

    # ── Admin ──────────────────────────────────────────────────────────

    async def clear_history(self, user_id: str) -> None:
        """Delete all conversation messages for a user."""
        if not self._pool:
            raise RuntimeError("MemoryRepository is not initialized.")

        try:
            await self._pool.execute(
                """
                DELETE FROM conversation_messages AS message
                USING conversations AS conversation
                WHERE message.conversation_id = conversation.id
                  AND conversation.user_id = $1
                """,
                user_id,
            )
            logger.info("[Memory] Cleared history for user %s", user_id)
        except Exception as exc:
            logger.error("[Memory] Failed to clear history for user %s: %s", user_id, exc)
            raise


memory_repository = MemoryRepository()
