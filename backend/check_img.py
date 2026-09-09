import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def check():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    rows = await conn.fetch("SELECT image_url FROM catalog_items LIMIT 5;")
    for r in rows:
        print(r['image_url'])
    await conn.close()

if __name__ == '__main__':
    asyncio.run(check())
