/**
 * Seed script to populate sample Catalog (Products, Inventory) and Customers
 * into the DistroSync ERP database for testing.
 *
 * Usage:
 *   node seed_catalog.js
 */

require('dotenv').config();
const prisma = require('./src/config/prisma');

const DEFAULT_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const SAMPLE_CUSTOMERS = [
    {
        name: 'Metro Wholesale Mart',
        phone: '+919900112233',
        externalId: 'CUST-101'
    },
    {
        name: 'Fresh Choice Retail',
        phone: '+919811334455',
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
        unit: 'bottle',
        price: 40.00,
        active: true,
        stock: 120
    },
    {
        sku: 'BIS-CHOC-100',
        name: 'Chocolate Biscuits 100g',
        description: 'Crunchy chocolate-flavoured cream biscuits',
        unit: 'packet',
        price: 35.00,
        active: true,
        stock: 85
    },
    {
        sku: 'COOK-OAT-200',
        name: 'Oat Cookies 200g',
        description: 'Premium baked oat cookies',
        unit: 'packet',
        price: 90.00,
        active: true,
        stock: 45
    },
    {
        sku: 'JUICE-ORG-1L',
        name: 'Orange Juice 1L',
        description: 'Refreshing orange fruit juice in a 1 litre pack',
        unit: 'box',
        price: 120.00,
        active: true,
        stock: 60
    },
    {
        sku: 'SOAP-FRESH-125',
        name: 'Fresh Bath Soap 125g',
        description: 'Daily-use refreshing bathing soap',
        unit: 'piece',
        price: 38.00,
        active: true,
        stock: 150
    },
    {
        sku: 'DET-LIQ-1L',
        name: 'Liquid Detergent 1L',
        description: 'Concentrated liquid detergent for everyday washing',
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

    console.log('\n--- 1. Creating Customers ---');

    for (const cust of SAMPLE_CUSTOMERS) {
        const existing = await prisma.customer.findFirst({
            where: {
                tenantId: DEFAULT_TENANT_ID,
                externalId: cust.externalId
            }
        });

        if (existing) {
            console.log(
                `[SKIP] Customer already exists: ${existing.name} (${existing.phone}) -> ID: ${existing.id}`
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

        console.log(
            `[CREATED] Customer: ${created.name} (${created.phone}) -> ID: ${created.id}`
        );
    }

    console.log('\n--- 2. Creating Products & Inventory ---');

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
            const stock = existing.inventory
                ? existing.inventory.availableQuantity
                : 0;

            console.log(
                `[SKIP] Product already exists: ${existing.name} (${existing.sku}) -> ID: ${existing.id} | Stock: ${stock}`
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

        console.log(
            `[CREATED] Product: ${createdProduct.name} (${createdProduct.sku}) -> ID: ${createdProduct.id} | Stock: ${prod.stock} ${prod.unit}s | Price: ₹${prod.price}`
        );
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