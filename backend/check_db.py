import asyncio
# pyrefly: ignore [missing-import]
import asyncpg
import os
from dotenv import load_dotenv

async def main():
    load_dotenv(override=True)
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    rows = await conn.fetch("SELECT id, slug, brand_name FROM businesses")
    print("Businesses in DB:", rows)
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
