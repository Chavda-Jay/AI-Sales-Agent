import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv(override=True)

async def test():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'), statement_cache_size=0)
    try:
        prod_id = await conn.fetchval('SELECT id FROM catalog_items LIMIT 1')
        print('prod_id from catalog_items:', prod_id)
        order_db_id = await conn.fetchval(
            "INSERT INTO orders (customer_id, business_id, product_id, status, amount) VALUES (72, 1, $1, 'confirmed', 100) RETURNING id",
            prod_id
        )
        print('Order inserted:', order_db_id)
        
        await conn.execute("INSERT INTO retention_stages (order_id, customer_id, current_stage) VALUES ($1, $2, 'confirmed')", order_db_id, 73)
        print('Retention stage inserted')
    except Exception as e:
        print('Error:', e)
    finally:
        await conn.close()

asyncio.run(test())
