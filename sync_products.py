import asyncio
import asyncpg
import os
import json
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    with open('backend/business-config.json', 'r') as f:
        config = json.load(f)
        
    catalog = config.get('catalog', [])
    
    # Truncate products table first
    await conn.execute('TRUNCATE TABLE products RESTART IDENTITY CASCADE;')
    
    # Insert new products
    for p in catalog:
        await conn.execute(
            'INSERT INTO products (name, price, description, stock) VALUES ($1, $2, $3, $4)',
            p['name'], p['price'], p.get('note', ''), 100
        )
        
    await conn.close()
    print('Products synced successfully!')

asyncio.run(main())
