from groq import Groq

from app.core.config import settings
from app.core.exceptions import (
    LLMAuthenticationError,
    LLMConfigurationError,
    LLMProviderError,
    LLMTimeoutError,
)
from app.intelligence.llm.response_parser import response_parser


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
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        if not messages:
            raise LLMProviderError("At least one message is required.")

        print("[AI] Calling Groq")
        try:
            completion = self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=self.temperature if temperature is None else temperature,
                max_tokens=self.max_tokens if max_tokens is None else max_tokens,
            )
        except Exception as exc:
            error_name = exc.__class__.__name__.lower()
            if "authentication" in error_name or "permission" in error_name:
                raise LLMAuthenticationError("Groq authentication failed.") from exc
            if "timeout" in error_name:
                raise LLMTimeoutError("Groq request timed out.") from exc
            raise LLMProviderError("Groq request failed.") from exc

        print("[AI] Groq response received")
        return response_parser.parse(completion)


llm_client = LLMClient()
