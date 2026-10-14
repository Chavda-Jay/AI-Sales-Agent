import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    query = """
    SELECT c.id, c.name, c.segment, c.business_id,
           COUNT(o.id) FILTER (WHERE o.status='confirmed') AS confirmed_orders
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id HAVING COUNT(o.id) FILTER (WHERE o.status='confirmed') > 0
    AND c.segment IN ('COLD','WARM','HOT');
    """
    
    records = await conn.fetch(query)
    
    print("--- RAW SQL OUTPUT ---")
    for r in records:
        print(dict(r))
    print("----------------------")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
