import pytest
from pydantic import ValidationError

from app.tools.schemas import (
    CancelOrderArgs,
    CreateOrderArgs,
    CreateOrderItemInput,
    GetCustomerArgs,
    GetInventoryArgs,
    GetOrderArgs,
    GetOrderStatusArgs,
    GetProductArgs,
    SearchProductsArgs,
    ToolResult,
    UpdateOrderArgs,
)


class TestToolSchemas:
    def test_search_products_args_valid(self):
        args = SearchProductsArgs(query="ABC123", limit=5)
        assert args.query == "ABC123"
        assert args.limit == 5

    def test_search_products_args_defaults(self):
        args = SearchProductsArgs(query="shampoo")
        assert args.limit == 10

    def test_search_products_args_invalid_empty_query(self):
        with pytest.raises(ValidationError):
            SearchProductsArgs(query="")

    def test_get_product_args_valid(self):
        args = GetProductArgs(product_id="prod-uuid-123")
        assert args.product_id == "prod-uuid-123"

    def test_get_product_args_invalid_empty(self):
        with pytest.raises(ValidationError):
            GetProductArgs(product_id="")

    def test_get_inventory_args_valid(self):
        args = GetInventoryArgs(product_id="prod-uuid-123")
        assert args.product_id == "prod-uuid-123"

    def test_get_customer_args_valid(self):
        args1 = GetCustomerArgs(customer_id="cust-123")
        assert args1.customer_id == "cust-123"

        args2 = GetCustomerArgs(phone="+919876543210")
        assert args2.phone == "+919876543210"

    def test_get_order_args_valid(self):
        args = GetOrderArgs(order_id="order-uuid-123")
        assert args.order_id == "order-uuid-123"

    def test_get_order_status_args_valid(self):
        args = GetOrderStatusArgs(order_id="order-uuid-123")
        assert args.order_id == "order-uuid-123"

    def test_create_order_args_valid(self):
        args = CreateOrderArgs(
            customer_id="cust-uuid-123",
            items=[
                CreateOrderItemInput(product_id="prod-1", quantity=20),
                CreateOrderItemInput(product_id="prod-2", quantity=5),
            ],
        )
        assert args.customer_id == "cust-uuid-123"
        assert len(args.items) == 2
        assert args.items[0].quantity == 20

    def test_create_order_args_invalid_empty_items(self):
        with pytest.raises(ValidationError):
            CreateOrderArgs(customer_id="cust-1", items=[])

    def test_create_order_args_invalid_negative_quantity(self):
        with pytest.raises(ValidationError):
            CreateOrderArgs(
                customer_id="cust-1",
                items=[CreateOrderItemInput(product_id="prod-1", quantity=0)],
            )

    def test_cancel_order_args_valid(self):
        args = CancelOrderArgs(order_id="order-uuid-123")
        assert args.order_id == "order-uuid-123"

    def test_update_order_args_valid(self):
        args = UpdateOrderArgs(order_id="order-uuid-123", shipping_address="123 Main St")
        assert args.order_id == "order-uuid-123"
        assert args.shipping_address == "123 Main St"

    def test_tool_result_helpers(self):
        ok = ToolResult.ok("search_products", {"items": [1, 2]})
        assert ok.success is True
        assert ok.data == {"items": [1, 2]}
        assert ok.error is None

        fail = ToolResult.fail("create_order", "INSUFFICIENT_INVENTORY", "Out of stock", {"avail": 0})
        assert fail.success is False
        assert fail.error.code == "INSUFFICIENT_INVENTORY"
        assert fail.error.message == "Out of stock"
        assert fail.error.details == {"avail": 0}
