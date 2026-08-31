from app.core.exceptions import LLMResponseError


class GroqResponseParser:
    def parse(self, completion) -> str:
        """Extract assistant text from a Groq chat completion response."""
        try:
            choices = getattr(completion, "choices", None)
            if not choices:
                raise LLMResponseError("The LLM returned no choices.")

            message = getattr(choices[0], "message", None)
            content = getattr(message, "content", None)
            if content is None and isinstance(message, dict):
                content = message.get("content")

            if not isinstance(content, str) or not content.strip():
                raise LLMResponseError("The LLM returned an empty message.")

            return content.strip()
        except LLMResponseError:
            raise
        except Exception as exc:
            raise LLMResponseError("The LLM response was malformed.") from exc


response_parser = GroqResponseParser()
