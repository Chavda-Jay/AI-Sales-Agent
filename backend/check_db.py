import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'), statement_cache_size=0)
    
    # Catalog items - get columns first
    cols = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'catalog_items'")
    print("CATALOG COLUMNS:", [c['column_name'] for c in cols])
    
    items = await conn.fetch("SELECT * FROM catalog_items LIMIT 10")
    for i in items:
        print(dict(i))
    
    # Latest customers for lang check
    print("\nLATEST CUSTOMERS:")
    latest = await conn.fetch("SELECT id, ext_id, preferred_language FROM customers ORDER BY id DESC LIMIT 5")
    for l in latest:
        print(dict(l))
    
    # Admin users
    print("\nADMIN USERS:")
    admins = await conn.fetch("SELECT id, email, business_id FROM admin_users LIMIT 3")
    for a in admins:
        print(dict(a))
    
    # Businesses
    print("\nBUSINESSES:")
    biz = await conn.fetch("SELECT id, slug, name FROM businesses LIMIT 3")
    for b in biz:
        print(dict(b))
    
    await conn.close()

asyncio.run(run())
