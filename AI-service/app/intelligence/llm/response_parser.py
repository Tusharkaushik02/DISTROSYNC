import json
import logging
from typing import Any
from pydantic import BaseModel, Field

from app.core.exceptions import LLMResponseError

logger = logging.getLogger(__name__)


class ParsedToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    raw_arguments: str = ""


class ParsedLLMResponse(BaseModel):
    content: str | None = None
    tool_calls: list[ParsedToolCall] = Field(default_factory=list)
    has_tool_calls: bool = False
    raw_message: dict[str, Any] = Field(default_factory=dict)


class GroqResponseParser:
    """Parses Groq completions into text and/or structured tool calls."""

    def parse(self, completion: Any) -> ParsedLLMResponse:
        """Extract assistant text and/or tool calls from a Groq chat completion response."""
        try:
            choices = getattr(completion, "choices", None)
            if not choices:
                raise LLMResponseError("The LLM returned no choices.")

            choice = choices[0]
            message = getattr(choice, "message", None)
            if message is None and isinstance(choice, dict):
                message = choice.get("message")

            if message is None:
                raise LLMResponseError("The LLM response choice contained no message.")

            # Extract content
            content = getattr(message, "content", None)
            if content is None and isinstance(message, dict):
                content = message.get("content")

            # Extract tool calls
            tool_calls_raw = getattr(message, "tool_calls", None)
            if tool_calls_raw is None and isinstance(message, dict):
                tool_calls_raw = message.get("tool_calls")

            parsed_tool_calls: list[ParsedToolCall] = []

            if tool_calls_raw:
                for tc in tool_calls_raw:
                    tc_id = getattr(tc, "id", "") or (tc.get("id", "") if isinstance(tc, dict) else "")
                    func = getattr(tc, "function", None) or (tc.get("function", {}) if isinstance(tc, dict) else {})
                    func_name = getattr(func, "name", "") or (func.get("name", "") if isinstance(func, dict) else "")
                    func_args_str = getattr(func, "arguments", "") or (func.get("arguments", "") if isinstance(func, dict) else "")

                    parsed_args = {}
                    if func_args_str:
                        try:
                            parsed_args = json.loads(func_args_str) if isinstance(func_args_str, str) else func_args_str
                        except Exception as exc:
                            logger.warning("[ResponseParser] Failed to parse JSON tool args for %s: %s", func_name, exc)
                            parsed_args = {}

                    parsed_tool_calls.append(
                        ParsedToolCall(
                            id=tc_id,
                            name=func_name,
                            arguments=parsed_args if isinstance(parsed_args, dict) else {},
                            raw_arguments=str(func_args_str),
                        )
                    )

            has_tools = len(parsed_tool_calls) > 0

            # Build serializable raw message for chat history
            raw_msg_dict: dict[str, Any] = {"role": "assistant"}
            if content:
                raw_msg_dict["content"] = content
            else:
                raw_msg_dict["content"] = None

            if has_tools:
                raw_msg_dict["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": tc.raw_arguments or json.dumps(tc.arguments),
                        },
                    }
                    for tc in parsed_tool_calls
                ]

            # Validation: must have either content or tool calls
            if not has_tools and (not isinstance(content, str) or not content.strip()):
                raise LLMResponseError("The LLM returned neither content nor tool calls.")

            return ParsedLLMResponse(
                content=content.strip() if isinstance(content, str) and content.strip() else None,
                tool_calls=parsed_tool_calls,
                has_tool_calls=has_tools,
                raw_message=raw_msg_dict,
            )

        except LLMResponseError:
            raise
        except Exception as exc:
            logger.error("[ResponseParser] Error parsing LLM response: %s", exc, exc_info=True)
            raise LLMResponseError(f"The LLM response was malformed: {str(exc)}") from exc


response_parser = GroqResponseParser()
