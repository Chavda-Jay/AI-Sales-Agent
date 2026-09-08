import asyncio
# pyrefly: ignore [missing-import]
import asyncpg
import os
from dotenv import load_dotenv

async def main():
    load_dotenv(override=True)
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"), statement_cache_size=0)
    
    # We delete where brand_name ILIKE '%grocery%' OR slug ILIKE '%freshmart%'
    res = await conn.execute("DELETE FROM businesses WHERE slug LIKE '%freshmart%' OR brand_name ILIKE '%grocery%'")
    print(f"Delete result: {res}")
            
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
