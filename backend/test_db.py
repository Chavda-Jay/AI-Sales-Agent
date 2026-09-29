import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    db_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    # Get user with >= 2 orders
    row = await conn.fetchrow("""
        SELECT c.ext_id, c.name, COUNT(o.id) as orders 
        FROM customers c 
        JOIN orders o ON c.id = o.customer_id 
        WHERE o.status = 'confirmed' 
        GROUP BY c.id 
        HAVING COUNT(o.id) >= 2 
        LIMIT 1;
    """)
    if row:
        print(f"Repeat Buyer: {row['name']} (Ext ID: {row['ext_id']}), Orders: {row['orders']}")
    else:
        print("No repeat buyers found.")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
