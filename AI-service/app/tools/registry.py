import logging
from typing import Any, Callable, Coroutine
from pydantic import BaseModel

from app.tools.schemas import ToolDefinition, ToolResult

logger = logging.getLogger(__name__)

ToolCallable = Callable[..., Coroutine[Any, Any, ToolResult]]


class ToolRegistry:
    """Central registry of tools available to the LLM."""

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._executors: dict[str, ToolCallable] = {}

    def register(
        self,
        name: str,
        description: str,
        args_schema: type[BaseModel],
        executor: ToolCallable,
        category: str = "read",
    ) -> None:
        """Register a tool with its schema and execution callable."""
        definition = ToolDefinition(
            name=name,
            description=description,
            args_schema=args_schema,
            category=category,
        )
        self._tools[name] = definition
        self._executors[name] = executor
        logger.info("[ToolRegistry] Registered tool: %s (%s)", name, category)

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def get_executor(self, name: str) -> ToolCallable | None:
        return self._executors.get(name)

    def get_all(self) -> dict[str, ToolDefinition]:
        return dict(self._tools)

    def is_registered(self, name: str) -> bool:
        return name in self._tools

    def get_tools_for_llm(self) -> list[dict[str, Any]]:
        """Generate OpenAI/Groq tool-calling function definitions from Pydantic schemas."""
        llm_tools = []
        for name, tool_def in self._tools.items():
            schema = tool_def.args_schema.model_json_schema()
            # Clean up schema for LLM tools format
            properties = schema.get("properties", {})
            required = schema.get("required", [])

            # Recursively resolve any $defs / $ref in schema if needed
            definitions = schema.get("$defs", {})
            for prop_name, prop_val in properties.items():
                if "$ref" in prop_val:
                    ref_name = prop_val["$ref"].split("/")[-1]
                    if ref_name in definitions:
                        properties[prop_name] = definitions[ref_name]
                elif "items" in prop_val and "$ref" in prop_val["items"]:
                    ref_name = prop_val["items"]["$ref"].split("/")[-1]
                    if ref_name in definitions:
                        prop_val["items"] = definitions[ref_name]

            llm_tools.append(
                {
                    "type": "function",
                    "function": {
                        "name": name,
                        "description": tool_def.description,
                        "parameters": {
                            "type": "object",
                            "properties": properties,
                            "required": required,
                        },
                    },
                }
            )
        return llm_tools


tool_registry = ToolRegistry()
