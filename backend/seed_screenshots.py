import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def seed():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL missing")
        return

    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    # 1. Get or create a customer
    cust_id = await conn.fetchval("SELECT id FROM customers LIMIT 1")
    if not cust_id:
        cust_id = await conn.fetchval("INSERT INTO customers (name, phone, segment) VALUES ('John Screenshot', '9999999999', 'HOT') RETURNING id")
    
    # 2. Get or create a business
    biz_id = await conn.fetchval("SELECT id FROM businesses LIMIT 1")
    if not biz_id:
        biz_id = await conn.fetchval("INSERT INTO businesses (slug, name) VALUES ('test-biz', 'Test Biz') RETURNING id")

    # 3. Get or create a catalog item
    prod_id = await conn.fetchval("SELECT id FROM catalog_items WHERE business_id = $1 LIMIT 1", biz_id)
    if not prod_id:
        prod_id = await conn.fetchval("INSERT INTO catalog_items (business_id, name, price, description, images) VALUES ($1, 'Screenshot Test Product', 9999, 'Test', '[\"https://via.placeholder.com/150\"]') RETURNING id", biz_id)

    # 4. Insert a pending_approval order
    await conn.execute("""
        INSERT INTO orders (customer_id, business_id, product_id, amount, status)
        VALUES ($1, $2, $3, 9999, 'pending_approval')
    """, cust_id, biz_id, prod_id)

    # 5. Insert a handoff with all fields (context_summary, objection, etc)
    await conn.execute("""
        INSERT INTO handoffs (customer_id, reason, status, context_summary, product_interest, objection, intent_score, estimated_value, urgency)
        VALUES ($1, 'Customer needs human assistance to apply discount code', 'pending', 
                'User is trying to buy 3 Screenshot Test Products but card is failing', 
                'Screenshot Test Product', 
                'Price is too high without discount', 
                95, 29997, 'High')
    """, cust_id)

    print("Data seeded successfully!")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
