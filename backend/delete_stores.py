import asyncio
# pyrefly: ignore [missing-import]
import asyncpg
import os
from dotenv import load_dotenv

async def main():
    load_dotenv(override=True)
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"), statement_cache_size=0)
    
    brand_names = ["NEHA'S BOUTIQUE", "MY SUPER STORE"]
    
    for brand in brand_names:
        row = await conn.fetchrow("SELECT id FROM businesses WHERE brand_name ILIKE $1", brand)
        if row:
            b_id = row['id']
            print(f"Found {brand} with ID {b_id}. Deleting references...")
            
            # Delete from tables without ON DELETE CASCADE
            await conn.execute("DELETE FROM orders WHERE business_id = $1", b_id)
            await conn.execute("DELETE FROM conversations WHERE business_id = $1", b_id)
            await conn.execute("DELETE FROM customers WHERE business_id = $1", b_id)
            
            # Delete main business (catalog_items and admin_users delete automatically due to CASCADE)
            await conn.execute("DELETE FROM businesses WHERE id = $1", b_id)
            print(f"[OK] Deleted {brand} completely from the Database.")
        else:
            print(f"[ERROR] {brand} not found in database.")
            
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
