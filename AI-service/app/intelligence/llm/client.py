import logging
import time
from typing import Any
from groq import Groq, RateLimitError

from app.core.config import settings
from app.core.exceptions import (
    LLMAuthenticationError,
    LLMConfigurationError,
    LLMProviderError,
    LLMTimeoutError,
)
from app.intelligence.llm.response_parser import ParsedLLMResponse, response_parser

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self, groq_client=None):
        self.model = settings.GROQ_MODEL
        self.timeout = settings.GROQ_TIMEOUT_SECONDS
        self.temperature = settings.GROQ_TEMPERATURE
        self.max_tokens = settings.GROQ_MAX_TOKENS
        self._client = groq_client

    @property
    def client(self):
        if self._client is not None:
            return self._client

        if not settings.GROQ_API_KEY:
            raise LLMConfigurationError("GROQ_API_KEY is not configured.")

        self._client = Groq(api_key=settings.GROQ_API_KEY, timeout=self.timeout)
        return self._client

    def generate_response(
        self,
        messages: list[dict],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> ParsedLLMResponse:
        if not messages:
            raise LLMProviderError("At least one message is required.")

        logger.info("[LLMClient] Calling Groq (model=%s, tools_count=%d)", model or self.model, len(tools or []))

        kwargs: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": self.temperature if temperature is None else temperature,
            "max_tokens": self.max_tokens if max_tokens is None else max_tokens,
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        max_retries = 3
        backoff_sec = 2.0

        for attempt in range(1, max_retries + 1):
            try:
                completion = self.client.chat.completions.create(**kwargs)
                logger.info("[LLMClient] Groq response received on attempt %d", attempt)
                return response_parser.parse(completion)
            except RateLimitError as exc:
                logger.warning("[LLMClient] Groq rate limit (attempt %d/%d): %s. Backing off %ss...", attempt, max_retries, exc, backoff_sec)
                if attempt == max_retries:
                    raise LLMProviderError(f"Groq request rate limit exceeded: {str(exc)}") from exc
                time.sleep(backoff_sec)
                backoff_sec *= 2.0
            except Exception as exc:
                error_name = exc.__class__.__name__.lower()
                logger.error("[LLMClient] Groq call failed: %s", exc)
                if "authentication" in error_name or "permission" in error_name:
                    raise LLMAuthenticationError("Groq authentication failed.") from exc
                if "timeout" in error_name:
                    raise LLMTimeoutError("Groq request timed out.") from exc
                raise LLMProviderError(f"Groq request failed: {str(exc)}") from exc

        raise LLMProviderError("Groq request failed after retries.")


llm_client = LLMClient()
