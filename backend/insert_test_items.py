import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'), statement_cache_size=0)
    business_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = 'sharma-electronics'")
    
    # Insert test items
    items = [
        ("Cotton T-shirt", 499, "Basic comfortable cotton T-shirt, everyday wear."),
        ("Formal Shirt", 1299, "Premium formal shirt for office and meetings. Better fabric."),
        ("Sports Sneakers", 999, "Budget sports sneakers."),
        ("Premium Sneakers", 2499, "High quality premium sneakers with extra comfort.")
    ]
    
    for name, price, note in items:
        await conn.execute("""
            INSERT INTO catalog_items (business_id, name, price, note, image_url)
            VALUES ($1, $2, $3, $4, '')
        """, business_id, name, price, note)
    
    print("Inserted test items successfully.")
    await conn.close()

asyncio.run(main())
