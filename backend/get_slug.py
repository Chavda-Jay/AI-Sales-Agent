import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'), statement_cache_size=0)
    slug = await conn.fetchval("SELECT slug FROM businesses LIMIT 1")
    print(f"Slug: {slug}")
    await conn.close()

asyncio.run(main())
