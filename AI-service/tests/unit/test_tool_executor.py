import pytest
from pydantic import BaseModel

from app.core.exceptions import ERPServiceError
from app.tools.executor import ToolExecutor
from app.tools.registry import ToolRegistry
from app.tools.schemas import ToolResult


class DummyReadArgs(BaseModel):
    query: str


class DummyWriteArgs(BaseModel):
    product_id: str
    quantity: int


class TestToolExecutor:
    @pytest.fixture
    def custom_setup(self):
        reg = ToolRegistry()

        async def read_exec(args: DummyReadArgs, tenant_id: str, idempotency_key=None):
            if args.query == "throw_erp":
                raise ERPServiceError("Not found in ERP", error_code="PRODUCT_NOT_FOUND", status_code=404)
            if args.query == "crash":
                raise RuntimeError("Boom")
            return ToolResult.ok("read_tool", {"found": args.query, "tenant": tenant_id})

        async def write_exec(args: DummyWriteArgs, tenant_id: str, idempotency_key=None):
            return ToolResult.ok("write_tool", {"created": args.product_id, "qty": args.quantity, "key": idempotency_key})

        reg.register("read_tool", "Read desc", DummyReadArgs, read_exec, category="read")
        reg.register("write_tool", "Write desc", DummyWriteArgs, write_exec, category="write")

        executor = ToolExecutor(registry=reg)
        return executor

    @pytest.mark.asyncio
    async def test_successful_execution(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("read_tool", {"query": "ABC123"}, tenant_id="tenant-123")
        assert res.success is True
        assert res.data == {"found": "ABC123", "tenant": "tenant-123"}

    @pytest.mark.asyncio
    async def test_json_string_arguments_parsing(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("read_tool", '{"query": "XYZ999"}', tenant_id="tenant-123")
        assert res.success is True
        assert res.data["found"] == "XYZ999"

    @pytest.mark.asyncio
    async def test_invalid_json_string_rejection(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("read_tool", "invalid json string {", tenant_id="tenant-123")
        assert res.success is False
        assert res.error.code == "INVALID_ARGUMENTS_JSON"

    @pytest.mark.asyncio
    async def test_unknown_tool_rejection(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("unregistered_tool", {}, tenant_id="tenant-123")
        assert res.success is False
        assert res.error.code == "UNKNOWN_TOOL"

    @pytest.mark.asyncio
    async def test_schema_validation_failure(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("write_tool", {"product_id": "p1"}, tenant_id="tenant-123")
        assert res.success is False
        assert res.error.code == "INVALID_TOOL_ARGUMENTS"
        assert "quantity" in str(res.error.details)

    @pytest.mark.asyncio
    async def test_erp_error_normalization(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("read_tool", {"query": "throw_erp"}, tenant_id="tenant-123")
        assert res.success is False
        assert res.error.code == "PRODUCT_NOT_FOUND"
        assert "Not found in ERP" in res.error.message

    @pytest.mark.asyncio
    async def test_unexpected_exception_handling(self, custom_setup):
        executor = custom_setup
        res = await executor.execute("read_tool", {"query": "crash"}, tenant_id="tenant-123")
        assert res.success is False
        assert res.error.code == "INTERNAL_TOOL_ERROR"

    @pytest.mark.asyncio
    async def test_write_tool_idempotency_caching(self, custom_setup):
        executor = custom_setup
        args = {"product_id": "p100", "quantity": 10}

        # First write
        res1 = await executor.execute("write_tool", args, tenant_id="tenant-1")
        assert res1.success is True

        # Duplicate write with exact same args & tenant
        res2 = await executor.execute("write_tool", args, tenant_id="tenant-1")
        assert res2.success is True
        assert res2.data == res1.data
