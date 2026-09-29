import asyncio, asyncpg, os, json
from dotenv import load_dotenv
load_dotenv()

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'), statement_cache_size=0)
    
    # Find customers with names
    rows = await conn.fetch("""
        SELECT c.id, c.ext_id, c.name, c.city, c.state, c.segment, c.lifetime_value,
               (SELECT p.name FROM orders o LEFT JOIN catalog_items p ON p.id = o.product_id 
                WHERE o.customer_id = c.id AND o.status = 'confirmed' 
                ORDER BY o.created_at DESC LIMIT 1) as last_product
        FROM customers c
        WHERE c.name IS NOT NULL AND c.name != ''
        LIMIT 5
    """)
    
    for r in rows:
        print(json.dumps({
            "id": r['id'], "ext_id": r['ext_id'], "name": r['name'],
            "city": r['city'], "state": r['state'], "segment": r['segment'],
            "ltv": float(r['lifetime_value']) if r['lifetime_value'] else 0,
            "last_product": r['last_product']
        }, ensure_ascii=False))
    
    await conn.close()

asyncio.run(main())
