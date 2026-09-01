"""Conversation memory service.

Thin business-logic layer that wraps the repository.
The orchestrator depends on this service — never on the repository directly.
"""

import logging

from app.core.config import settings
from app.memory.repository import MemoryRepository, memory_repository

logger = logging.getLogger(__name__)


class MemoryService:
    """Provides conversation history operations for the orchestrator."""

    def __init__(self, repository: MemoryRepository | None = None):
        self._repository = repository or memory_repository

    async def initialize(self) -> None:
        """Initialize the underlying repository (create table, pool, etc.)."""
        await self._repository.initialize()

    async def close(self) -> None:
        """Shutdown the underlying repository."""
        await self._repository.close()

    async def get_history(self, user_id: str, limit: int | None = None) -> list[dict]:
        """Return recent messages formatted for the LLM.

        Each item is ``{"role": "user"|"assistant", "content": "..."}``.
        Messages are returned in chronological order (oldest first).
        """
        effective_limit = limit if limit is not None else settings.CONVERSATION_HISTORY_LIMIT
        return await self._repository.get_history(user_id, limit=effective_limit)

    async def save_message(self, user_id: str, role: str, content: str) -> None:
        """Persist a single user or assistant message."""
        await self._repository.save_message(user_id, role, content)

    async def clear_history(self, user_id: str) -> None:
        """Delete all conversation messages for a user."""
        await self._repository.clear_history(user_id)


memory_service = MemoryService()
