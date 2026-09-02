/**
 * Seed script to populate sample Catalog (Products, Inventory) and Customers
 * into the DistroSync ERP database for testing.
 *
 * Usage:
 *   node seed_catalog.js
 */

require('dotenv').config();
const prisma = require('./src/config/prisma');

// Default tenant ID used across development & testing
const DEFAULT_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const SAMPLE_CUSTOMERS = [
    {
        name: 'Sourav Upreti',
        phone: '+919876543210',
        externalId: 'CUST-001'
    },
    {
        name: 'Sharma General Store',
        phone: '+919811223344',
        externalId: 'CUST-002'
    },
    {
        name: 'City Supermarket',
        phone: '+919988776655',
        externalId: 'CUST-003'
    }
];

const SAMPLE_PRODUCTS = [
    {
        sku: 'ABC123',
        name: 'ABC123 Energy Drink 250ml',
        description: 'Refreshing caffeinated energy drink in 24-can cases',
        unit: 'box',
        price: 50.00,
        active: true,
        stock: 73
    },
    {
        sku: 'SHP-250',
        name: 'Blue Shampoo 250ml',
        description: 'Moisturizing anti-dandruff hair shampoo (250ml bottle)',
        unit: 'bottle',
        price: 150.00,
        active: true,
        stock: 30
    },
    {
        sku: 'SHP-500',
        name: 'Blue Shampoo 500ml',
        description: 'Family size moisturizing anti-dandruff hair shampoo (500ml bottle)',
        unit: 'bottle',
        price: 280.00,
        active: true,
        stock: 15
    },
    {
        sku: 'TATA-SALT-1KG',
        name: 'Tata Salt 1kg Pack',
        description: 'Vacuum evaporated iodized edible salt',
        unit: 'packet',
        price: 28.00,
        active: true,
        stock: 100
    },
    {
        sku: 'MANGO-ALPHANSO',
        name: 'Ratnagiri Alphonso Mangoes',
        description: 'Premium grade export quality Alphonso mangoes (1 Dozen Box)',
        unit: 'box',
        price: 850.00,
        active: true,
        stock: 50
    }
];

async function seed() {
    console.log('============================================================');
    console.log('SEEDING ERP DATABASE WITH SAMPLE CATALOG & CUSTOMERS');
    console.log(`Tenant ID: ${DEFAULT_TENANT_ID}`);
    console.log('============================================================\n');

    // 1. Seed Customers
    console.log('--- 1. Creating Customers ---');
    for (const cust of SAMPLE_CUSTOMERS) {
        const existing = await prisma.customer.findFirst({
            where: { tenantId: DEFAULT_TENANT_ID, phone: cust.phone }
        });

        if (existing) {
            console.log(`[SKIP] Customer already exists: ${cust.name} (${cust.phone}) -> ID: ${existing.id}`);
        } else {
            const created = await prisma.customer.create({
                data: {
                    tenantId: DEFAULT_TENANT_ID,
                    name: cust.name,
                    phone: cust.phone,
                    externalId: cust.externalId
                }
            });
            console.log(`[CREATED] Customer: ${created.name} (${created.phone}) -> ID: ${created.id}`);
        }
    }

    // 2. Seed Products and Inventory
    console.log('\n--- 2. Creating Products & Inventory ---');
    for (const prod of SAMPLE_PRODUCTS) {
        const existing = await prisma.product.findFirst({
            where: { tenantId: DEFAULT_TENANT_ID, sku: prod.sku },
            include: { inventory: true }
        });

        if (existing) {
            console.log(`[SKIP] Product already exists: ${prod.name} (${prod.sku}) -> ID: ${existing.id} | Stock: ${existing.inventory ? existing.inventory.availableQuantity : 0}`);
        } else {
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

            console.log(`[CREATED] Product: ${createdProduct.name} (${createdProduct.sku}) -> ID: ${createdProduct.id} | Initial Stock: ${prod.stock} ${prod.unit}s | Price: ₹${prod.price}`);
        }
    }

    console.log('\n============================================================');
    console.log('SEEDING COMPLETED SUCCESSFULLY!');
    console.log('============================================================');
}

seed()
    .catch((err) => {
        console.error('Seeding failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
