import asyncio
import asyncpg
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

async def fetch_dashboard_stats():
    async with httpx.AsyncClient() as client:
        res = await client.get("http://127.0.0.1:3001/api/daily-report?shop=sharma-electronics", timeout=10)
        data = res.json()
        print(f"Total customers: {data.get('total_customers')}")
        print("Segment Breakdown:", data.get('segment_breakdown'))

async def main():
    print("--- DASHBOARD BEFORE BACKFILL ---")
    await fetch_dashboard_stats()
    
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    # Show SELECT output again
    select_query = """
    SELECT c.id, c.name, c.segment, c.business_id,
           COUNT(o.id) FILTER (WHERE o.status='confirmed') AS confirmed_orders
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id HAVING COUNT(o.id) FILTER (WHERE o.status='confirmed') > 0
    AND c.segment IN ('COLD','WARM','HOT');
    """
    records = await conn.fetch(select_query)
    print("\n--- ROWS TO UPDATE ---")
    for r in records:
        print(dict(r))
        
    # Update logic
    update_query = """
    UPDATE customers c
    SET segment = CASE
            WHEN sub.confirmed_orders >= 2 THEN 'REPEAT CUSTOMER'
            ELSE 'CUSTOMER'
        END
    FROM (
        SELECT c.id,
               COUNT(o.id) FILTER (WHERE o.status='confirmed') AS confirmed_orders
        FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id HAVING COUNT(o.id) FILTER (WHERE o.status='confirmed') > 0
        AND c.segment IN ('COLD','WARM','HOT')
    ) as sub
    WHERE c.id = sub.id;
    """
    res = await conn.execute(update_query)
    print(f"\nBackfill Complete: {res}")
    await conn.close()
    
    print("\n--- DASHBOARD AFTER BACKFILL ---")
    await fetch_dashboard_stats()

if __name__ == "__main__":
    asyncio.run(main())
