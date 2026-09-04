from typing import Any, Literal
from pydantic import BaseModel, Field


# ── Tool Result Wrapper ──────────────────────────────────────────────────

class ToolError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ToolResult(BaseModel):
    success: bool
    tool_name: str
    data: Any = None
    error: ToolError | None = None

    @classmethod
    def ok(cls, tool_name: str, data: Any) -> "ToolResult":
        return cls(success=True, tool_name=tool_name, data=data)

    @classmethod
    def fail(cls, tool_name: str, code: str, message: str, details: dict[str, Any] | None = None) -> "ToolResult":
        return cls(
            success=False,
            tool_name=tool_name,
            error=ToolError(code=code, message=message, details=details),
        )


# ── Tool Argument Schemas ────────────────────────────────────────────────

class SearchProductsArgs(BaseModel):
    query: str = Field(..., min_length=1, description="Product name, SKU, or keyword to search for.")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of products to return.")


class GetProductArgs(BaseModel):
    product_id: str = Field(..., min_length=1, description="UUID of the product to retrieve.")


class GetInventoryArgs(BaseModel):
    product_id: str = Field(..., min_length=1, description="UUID of the product to check inventory for.")


class GetCustomerArgs(BaseModel):
    customer_id: str | None = Field(default=None, description="UUID of the customer.")
    phone: str | None = Field(default=None, description="Customer phone number (E.164 or digits).")
    name: str | None = Field(default=None, description="Customer name or search query to look up.")


class SearchCustomersArgs(BaseModel):
    query: str = Field(..., min_length=1, description="Customer name, company name, phone number, or identifier to search for.")
    limit: int = Field(default=5, ge=1, le=20, description="Maximum number of customer candidates to return.")


class GetOrderArgs(BaseModel):
    order_id: str = Field(..., min_length=1, description="UUID of the order to retrieve.")


class GetOrderStatusArgs(BaseModel):
    order_id: str = Field(..., min_length=1, description="UUID of the order to check status for.")


class SearchOrdersArgs(BaseModel):
    query: str = Field(..., min_length=1, description="Order query such as order ID, customer name, status, or product items.")
    customer_id: str | None = Field(default=None, description="Optional UUID of customer to filter orders for.")
    limit: int = Field(default=5, ge=1, le=20, description="Maximum number of orders to return.")


class CreateOrderItemInput(BaseModel):
    product_id: str = Field(..., min_length=1, description="UUID of the product to order.")
    quantity: int = Field(..., gt=0, description="Quantity to order (must be positive integer).")


class CreateOrderArgs(BaseModel):
    customer_id: str = Field(..., min_length=1, description="UUID of the customer placing the order.")
    items: list[CreateOrderItemInput] = Field(..., min_length=1, description="List of items to order with product_id and quantity.")


class CancelOrderArgs(BaseModel):
    order_id: str = Field(..., min_length=1, description="UUID of the order to cancel.")


# ── Tool Definition Metadata ─────────────────────────────────────────────

class ToolDefinition(BaseModel):
    name: str
    description: str
    args_schema: type[BaseModel]
    category: Literal["read", "write"] = "read"
