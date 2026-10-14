import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    print("=== TEST CUSTOMERS (UUID ext_id) ===")
    customers = await conn.fetch("""
        SELECT id, name, ext_id, segment, created_at, last_interaction 
        FROM customers 
        WHERE length(ext_id) = 36
        ORDER BY id;
    """)
    for c in customers:
        print(dict(c))
        # fetch their orders
        d_orders = await conn.fetch("SELECT id, amount, status, created_at FROM orders WHERE customer_id=$1", c['id'])
        print(f"  Orders: {[dict(do) for do in d_orders]}")

    print("\n=== CONVERSATIONS (Last 24h) ===")
    convs = await conn.fetchval("""
        SELECT COUNT(*) FROM conversations 
        WHERE created_at > NOW() - INTERVAL '1 day'
    """)
    print(f"Conversations count: {convs}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
