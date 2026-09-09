/**
 * Seed script to populate sample Catalog (Products, Inventory), Customers,
 * and sample Orders into the DistroSync ERP database for testing.
 *
 * Usage:
 *   node seed_catalog.js
 */

require('dotenv').config();
const prisma = require('./src/config/prisma');

const DEFAULT_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Customer details preserved as requested by the user
const SAMPLE_CUSTOMERS = [
    {
        name: 'sourav Wholesale Mart',
        phone: '+919354746261',
        externalId: 'CUST-101'
    },
    {
        name: 'tushar Choice Retail',
        phone: '+918287162023',
        externalId: 'CUST-102'
    },
    {
        name: 'Green Valley Superstore',
        phone: '+919822445566',
        externalId: 'CUST-103'
    },
    {
        name: 'Daily Needs Market',
        phone: '+919833556677',
        externalId: 'CUST-104'
    }
];

const SAMPLE_PRODUCTS = [
    {
        sku: 'COLA-500',
        name: 'Classic Cola 500ml',
        description: 'Carbonated cola beverage in a 500ml bottle',
        category: 'Beverages',
        tags: ['cold drink', 'cold drinks', 'soft drink', 'soft drinks', 'soda', 'beverage', 'beverages', 'carbonated', 'coke', 'cola'],
        unit: 'bottle',
        price: 40.00,
        active: true,
        stock: 120
    },
    {
        sku: 'COLA-CAN-330',
        name: 'Classic Cola 330ml Can',
        description: 'Chilled carbonated cola beverage in a 330ml aluminium can',
        category: 'Beverages',
        tags: ['cold drink', 'cold drinks', 'soft drink', 'soft drinks', 'soda', 'can', 'coke', 'cola', 'beverage'],
        unit: 'can',
        price: 35.00,
        active: true,
        stock: 80
    },
    {
        sku: 'JUICE-ORG-1L',
        name: 'Orange Juice 1L',
        description: 'Refreshing orange fruit juice in a 1 litre pack',
        category: 'Beverages',
        tags: ['juice', 'cold drink', 'cold drinks', 'drink', 'drinks', 'orange', 'fruit juice', 'beverage', 'beverages'],
        unit: 'box',
        price: 120.00,
        active: true,
        stock: 60
    },
    {
        sku: 'BIS-CHOC-100',
        name: 'Chocolate Biscuits 100g',
        description: 'Crunchy chocolate-flavoured cream biscuits',
        category: 'Snacks',
        tags: ['biscuit', 'biscuits', 'cookies', 'snack', 'snacks', 'chocolate', 'sweet'],
        unit: 'packet',
        price: 35.00,
        active: true,
        stock: 85
    },
    {
        sku: 'COOK-OAT-200',
        name: 'Oat Cookies 200g',
        description: 'Premium baked oat cookies',
        category: 'Snacks',
        tags: ['cookies', 'oat', 'biscuit', 'biscuits', 'snack', 'snacks', 'healthy'],
        unit: 'packet',
        price: 90.00,
        active: true,
        stock: 45
    },
    {
        sku: 'CHIPS-MAS-50',
        name: 'Spiced Potato Chips 50g',
        description: 'Crispy salted and spiced potato chips',
        category: 'Snacks',
        tags: ['chips', 'potato chips', 'crisps', 'snack', 'snacks', 'spicy', 'namkeen'],
        unit: 'packet',
        price: 20.00,
        active: true,
        stock: 110
    },
    {
        sku: 'SOAP-FRESH-125',
        name: 'Fresh Bath Soap 125g',
        description: 'Daily-use refreshing bathing soap',
        category: 'Personal Care',
        tags: ['soap', 'bath', 'bathing', 'personal care', 'hygiene', 'fresh'],
        unit: 'piece',
        price: 38.00,
        active: true,
        stock: 150
    },
    {
        sku: 'SHAMP-BLUE-200',
        name: 'Cooling Blue Shampoo 200ml',
        description: 'Menthol cooling anti-dandruff shampoo in 200ml bottle',
        category: 'Personal Care',
        tags: ['shampoo', 'hair care', 'blue shampoo', 'cooling', 'menthol', 'personal care'],
        unit: 'bottle',
        price: 160.00,
        active: true,
        stock: 50
    },
    {
        sku: 'SHAMP-YEL-200',
        name: 'Lemon Fresh Shampoo 200ml',
        description: 'Natural lemon extract shine and nourishing shampoo 200ml',
        category: 'Personal Care',
        tags: ['shampoo', 'hair care', 'yellow shampoo', 'lemon', 'personal care'],
        unit: 'bottle',
        price: 155.00,
        active: true,
        stock: 40
    },
    {
        sku: 'DET-LIQ-1L',
        name: 'Liquid Detergent 1L',
        description: 'Concentrated liquid detergent for everyday washing',
        category: 'Household',
        tags: ['detergent', 'washing', 'laundry', 'liquid', 'cleaning', 'household'],
        unit: 'bottle',
        price: 210.00,
        active: true,
        stock: 40
    }
];

async function seed() {
    console.log('============================================================');
    console.log('SEEDING ERP DATABASE WITH SAMPLE CATALOG & CUSTOMERS');
    console.log(`Tenant ID: ${DEFAULT_TENANT_ID}`);
    console.log('============================================================');

    console.log('\n--- 1. Creating/Updating Customers ---');

    const createdCustomers = {};

    for (const cust of SAMPLE_CUSTOMERS) {
        const existing = await prisma.customer.findFirst({
            where: {
                tenantId: DEFAULT_TENANT_ID,
                OR: [
                    { externalId: cust.externalId },
                    { phone: cust.phone }
                ]
            }
        });

        if (existing) {
            const updated = await prisma.customer.update({
                where: { id: existing.id },
                data: {
                    name: cust.name,
                    phone: cust.phone,
                    externalId: cust.externalId
                }
            });
            createdCustomers[cust.externalId] = updated;
            console.log(
                `[UPDATED] Customer: ${updated.name} (${updated.phone}) -> ID: ${updated.id}`
            );
            continue;
        }

        const created = await prisma.customer.create({
            data: {
                tenantId: DEFAULT_TENANT_ID,
                name: cust.name,
                phone: cust.phone,
                externalId: cust.externalId
            }
        });
        createdCustomers[cust.externalId] = created;

        console.log(
            `[CREATED] Customer: ${created.name} (${created.phone}) -> ID: ${created.id}`
        );
    }

    console.log('\n--- 2. Creating/Updating Products & Inventory ---');

    const createdProducts = {};

    for (const prod of SAMPLE_PRODUCTS) {
        const existing = await prisma.product.findFirst({
            where: {
                tenantId: DEFAULT_TENANT_ID,
                sku: prod.sku
            },
            include: {
                inventory: true
            }
        });

        if (existing) {
            const updated = await prisma.product.update({
                where: { id: existing.id },
                data: {
                    name: prod.name,
                    description: prod.description,
                    category: prod.category,
                    tags: prod.tags || [],
                    unit: prod.unit,
                    price: prod.price,
                    active: prod.active
                }
            });

            if (existing.inventory) {
                await prisma.inventory.update({
                    where: { id: existing.inventory.id },
                    data: {
                        availableQuantity: prod.stock
                    }
                });
            } else {
                await prisma.inventory.create({
                    data: {
                        tenantId: DEFAULT_TENANT_ID,
                        productId: existing.id,
                        availableQuantity: prod.stock,
                        reservedQuantity: 0
                    }
                });
            }

            createdProducts[prod.sku] = updated;
            console.log(
                `[UPDATED] Product: ${updated.name} (${updated.sku}) -> Category: ${prod.category} | Stock: ${prod.stock}`
            );
            continue;
        }

        const createdProduct = await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    tenantId: DEFAULT_TENANT_ID,
                    sku: prod.sku,
                    name: prod.name,
                    description: prod.description,
                    category: prod.category,
                    tags: prod.tags || [],
                    unit: prod.unit,
                    price: prod.price,
                    active: prod.active
                }
            });

            await tx.inventory.create({
                data: {
                    tenantId: DEFAULT_TENANT_ID,
                    productId: product.id,
                    availableQuantity: prod.stock,
                    reservedQuantity: 0
                }
            });

            return product;
        });

        createdProducts[prod.sku] = createdProduct;
        console.log(
            `[CREATED] Product: ${createdProduct.name} (${createdProduct.sku}) -> ID: ${createdProduct.id} | Stock: ${prod.stock} ${prod.unit}s | Price: ₹${prod.price}`
        );
    }

    console.log('\n--- 3. Creating Sample Test Orders ---');

    const souravCust = createdCustomers['CUST-101'];
    const colaProd = createdProducts['COLA-500'];
    const biscuitsProd = createdProducts['BIS-CHOC-100'];

    if (souravCust && colaProd && biscuitsProd) {
        const existingOrder = await prisma.order.findFirst({
            where: {
                tenantId: DEFAULT_TENANT_ID,
                customerId: souravCust.id,
                status: 'CONFIRMED'
            }
        });

        if (!existingOrder) {
            const sampleOrder = await prisma.$transaction(async (tx) => {
                const order = await tx.order.create({
                    data: {
                        tenantId: DEFAULT_TENANT_ID,
                        customerId: souravCust.id,
                        status: 'CONFIRMED',
                        totalAmount: 950.00,
                        shippingAddress: 'Warehouse 4, Industrial Area, Sector 62, Noida, UP 201301',
                        items: {
                            create: [
                                {
                                    productId: colaProd.id,
                                    quantity: 20,
                                    unitPrice: 40.00,
                                    totalPrice: 800.00
                                },
                                {
                                    productId: biscuitsProd.id,
                                    quantity: 5,
                                    unitPrice: 30.00,
                                    totalPrice: 150.00
                                }
                            ]
                        }
                    }
                });

                // Reserve inventory for the sample order items
                await tx.inventory.updateMany({
                    where: { productId: colaProd.id, tenantId: DEFAULT_TENANT_ID },
                    data: { availableQuantity: { decrement: 20 }, reservedQuantity: { increment: 20 } }
                });
                await tx.inventory.updateMany({
                    where: { productId: biscuitsProd.id, tenantId: DEFAULT_TENANT_ID },
                    data: { availableQuantity: { decrement: 5 }, reservedQuantity: { increment: 5 } }
                });

                return order;
            });

            console.log(
                `[CREATED] Sample Order for ${souravCust.name}: ID=${sampleOrder.id} | Address="${sampleOrder.shippingAddress}" | Status=${sampleOrder.status}`
            );
        } else {
            console.log(
                `[EXISTS] Sample Order for ${souravCust.name} already present: ID=${existingOrder.id} | Address="${existingOrder.shippingAddress || 'N/A'}"`
            );
        }
    }

    console.log('\n============================================================');
    console.log('SEEDING COMPLETED SUCCESSFULLY!');
    console.log('============================================================');
}

seed()
    .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });