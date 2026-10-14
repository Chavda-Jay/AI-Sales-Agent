import asyncio
import asyncpg
import os
import json
import uuid
from dotenv import load_dotenv

load_dotenv()

async def get_dashboard(conn):
    rows = await conn.fetch("SELECT segment, COUNT(*) FROM customers WHERE business_id=1 GROUP BY segment")
    return {r['segment']: r['count'] for r in rows}

async def get_seg(conn, ext_id):
    return await conn.fetchval("SELECT segment FROM customers WHERE ext_id=$1", ext_id)

async def main():
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    # We already ran the backfill! Paresh is now CUSTOMER.
    print("--- [DASHBOARD STATS (AFTER BACKFILL)] ---")
    print(await get_dashboard(conn))

    # To test logic without LLM, we can just call the db directly or we have to use /api/chat.
    # Actually I will use /api/chat to be fully authentic for the validation output.
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
