"""PostgreSQL-backed conversation memory repository.

Uses asyncpg for non-blocking access to the shared PostgreSQL instance.
The table is created automatically on startup via ``initialize()``.
"""

import logging
from datetime import datetime, timezone

import asyncpg

from app.core.config import settings

logger = logging.getLogger(__name__)


class MemoryRepository:
    """Low-level persistence layer for conversation messages."""

    def __init__(self, database_url: str | None = None):
        self._database_url = database_url or settings.DATABASE_URL
        self._pool: asyncpg.Pool | None = None

    # ── Lifecycle ──────────────────────────────────────────────────────

    async def initialize(self) -> None:
        """Create the connection pool and ensure the table + indexes exist."""
        try:
            self._pool = await asyncpg.create_pool(
                dsn=self._database_url,
                min_size=2,
                max_size=10,
            )

            async with self._pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS conversation_messages (
                        id          BIGSERIAL PRIMARY KEY,
                        user_id     TEXT        NOT NULL,
                        role        TEXT        NOT NULL,
                        content     TEXT        NOT NULL,
                        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_conv_msg_user_created
                    ON conversation_messages (user_id, created_at);
                """)

            logger.info("[Memory] PostgreSQL repository initialized")
        except Exception as exc:
            logger.error("[Memory] Failed to initialize PostgreSQL repository: %s", exc)
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
                SELECT role, content
                FROM conversation_messages
                WHERE user_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT $2
                """,
                user_id,
                limit,
            )
            # Reverse so oldest message comes first (chronological order)
            return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]
        except Exception as exc:
            logger.error("[Memory] Failed to fetch history for user %s: %s", user_id, exc)
            raise

    # ── Write ──────────────────────────────────────────────────────────

    async def save_message(self, user_id: str, role: str, content: str) -> None:
        """Persist a single conversation message."""
        if not self._pool:
            raise RuntimeError("MemoryRepository is not initialized.")

        try:
            await self._pool.execute(
                """
                INSERT INTO conversation_messages (user_id, role, content, created_at)
                VALUES ($1, $2, $3, $4)
                """,
                user_id,
                role,
                content,
                datetime.now(timezone.utc),
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
                "DELETE FROM conversation_messages WHERE user_id = $1",
                user_id,
            )
            logger.info("[Memory] Cleared history for user %s", user_id)
        except Exception as exc:
            logger.error("[Memory] Failed to clear history for user %s: %s", user_id, exc)
            raise


memory_repository = MemoryRepository()
