from app.tools.catalog_tools import search_knowledge_base
from app.tools.customer_tools import get_customer, search_customers
from app.tools.inventory_tools import get_inventory
from app.tools.order_tools import (
    cancel_order,
    create_order,
    get_order,
    get_order_status,
    search_orders,
    update_order,
)
from app.tools.product_tools import get_product, search_products
from app.tools.registry import tool_registry
from app.tools.schemas import (
    CancelOrderArgs,
    CreateOrderArgs,
    GetCustomerArgs,
    GetInventoryArgs,
    GetOrderArgs,
    GetOrderStatusArgs,
    GetProductArgs,
    SearchCustomersArgs,
    SearchKnowledgeBaseArgs,
    SearchOrdersArgs,
    SearchProductsArgs,
    UpdateOrderArgs,
)

# ── Register Read Tools ──────────────────────────────────────────────────

tool_registry.register(
    name="search_products",
    description="Search for products by name, SKU, or description using semantic search. Resolves typos, synonyms, and natural language descriptions. Returns matching products with SKU, unit, price, and availability.",
    args_schema=SearchProductsArgs,
    executor=search_products,
    category="read",
)

tool_registry.register(
    name="get_product",
    description="Get complete product details including price, unit, and inventory by product UUID.",
    args_schema=GetProductArgs,
    executor=get_product,
    category="read",
)

tool_registry.register(
    name="get_inventory",
    description="Get current available and reserved inventory quantity for a specific product by product UUID.",
    args_schema=GetInventoryArgs,
    executor=get_inventory,
    category="read",
)

tool_registry.register(
    name="search_customers",
    description="Search for customers by name, company name, phone number, or external ID using semantic resolution.",
    args_schema=SearchCustomersArgs,
    executor=search_customers,
    category="read",
)

tool_registry.register(
    name="get_customer",
    description="Lookup a customer by customer UUID, phone number, or name to find their canonical account details.",
    args_schema=GetCustomerArgs,
    executor=get_customer,
    category="read",
)

tool_registry.register(
    name="search_orders",
    description="Search orders by order ID, customer name, status, or product items using semantic search.",
    args_schema=SearchOrdersArgs,
    executor=search_orders,
    category="read",
)

tool_registry.register(
    name="get_order",
    description="Get full order details including line items, total amount, and status by order UUID.",
    args_schema=GetOrderArgs,
    executor=get_order,
    category="read",
)

tool_registry.register(
    name="get_order_status",
    description="Check the current status (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED) of an order by order UUID.",
    args_schema=GetOrderStatusArgs,
    executor=get_order_status,
    category="read",
)

tool_registry.register(
    name="search_knowledge_base",
    description="Search the company's uploaded documents, policies, catalogs, FAQs, return rules, distributor guidelines, warranties, and knowledge base for relevant information.",
    args_schema=SearchKnowledgeBaseArgs,
    executor=search_knowledge_base,
    category="read",
)

# ── Register Write Tools ─────────────────────────────────────────────────

tool_registry.register(
    name="create_order",
    description="Place an order for a customer with a list of items (product_id and quantity) and optional shipping_address. Reserves inventory atomically in the ERP.",
    args_schema=CreateOrderArgs,
    executor=create_order,
    category="write",
)

tool_registry.register(
    name="update_order",
    description="Update mutable attributes of an existing order (such as shipping_address) without cancelling or recreating the order. Only PENDING or CONFIRMED orders can be modified.",
    args_schema=UpdateOrderArgs,
    executor=update_order,
    category="write",
)

tool_registry.register(
    name="cancel_order",
    description="Cancel an existing order by order UUID. Only use when customer explicitly requests cancellation. Does NOT modify addresses or orders.",
    args_schema=CancelOrderArgs,
    executor=cancel_order,
    category="write",
)

__all__ = ["tool_registry"]
