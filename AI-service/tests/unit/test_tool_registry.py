import pytest
from pydantic import BaseModel

from app.tools import tool_registry
from app.tools.registry import ToolRegistry
from app.tools.schemas import ToolResult


class DummyArgs(BaseModel):
    name: str


async def dummy_executor(args: DummyArgs, tenant_id: str, idempotency_key: str | None = None) -> ToolResult:
    return ToolResult.ok("dummy", {"hello": args.name})


class TestToolRegistry:
    def test_default_registry_has_all_required_tools(self):
        expected_tools = [
            "search_products",
            "get_product",
            "get_inventory",
            "get_customer",
            "get_order",
            "get_order_status",
            "create_order",
            "cancel_order",
        ]
        for tool_name in expected_tools:
            assert tool_registry.is_registered(tool_name), f"Tool {tool_name} not registered"
            tool_def = tool_registry.get_tool(tool_name)
            assert tool_def is not None
            assert tool_def.name == tool_name
            assert tool_def.args_schema is not None
            assert tool_registry.get_executor(tool_name) is not None

    def test_custom_registry_registration(self):
        reg = ToolRegistry()
        reg.register(
            name="test_tool",
            description="A test tool description",
            args_schema=DummyArgs,
            executor=dummy_executor,
            category="read",
        )

        assert reg.is_registered("test_tool")
        assert not reg.is_registered("unknown_tool")

        tool_def = reg.get_tool("test_tool")
        assert tool_def.name == "test_tool"
        assert tool_def.category == "read"

    def test_llm_tool_schema_generation(self):
        reg = ToolRegistry()
        reg.register(
            name="dummy_tool",
            description="Dummy description",
            args_schema=DummyArgs,
            executor=dummy_executor,
        )

        llm_tools = reg.get_tools_for_llm()
        assert len(llm_tools) == 1
        tool_spec = llm_tools[0]
        assert tool_spec["type"] == "function"
        assert tool_spec["function"]["name"] == "dummy_tool"
        assert tool_spec["function"]["description"] == "Dummy description"
        assert "name" in tool_spec["function"]["parameters"]["properties"]
        assert "name" in tool_spec["function"]["parameters"]["required"]
