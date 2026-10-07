import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def seed():
    db_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    biz_id = await conn.fetchval("SELECT id FROM businesses LIMIT 1")
    await conn.execute("UPDATE admin_users SET business_id = $1 WHERE email = 'test@example.com'", biz_id)

    print("Admin business updated!")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
