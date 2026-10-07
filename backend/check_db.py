import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def query_db():
    db_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    rows = await conn.fetch("SELECT slug FROM businesses")
    for r in rows:
        print(dict(r))
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(query_db())
