import asyncio
import asyncpg
import os

async def migrate():
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        await conn.execute("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS high_value_order_threshold NUMERIC DEFAULT NULL;")
        print("Migration successful")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(migrate())
