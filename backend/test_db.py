import asyncio
import os
import sys
import asyncpg
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
CUST_1 = "CUST-VAL-11"
CUST_2 = "CUST-VAL-21"
CUST_3 = "CUST-VAL-31"

async def run():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    # Check CUST-VAL-21
    db_cust2_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", CUST_2)
    small_order_row = await conn.fetchrow("SELECT id, status, amount FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1", db_cust2_id) if db_cust2_id else None
    print("TEST 4 SMALL ORDER:")
    print(dict(small_order_row) if small_order_row else "None")
    
    # Check CUST-VAL-31
    db_cust3_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", CUST_3)
    last_conv = await conn.fetchrow("SELECT message, reply FROM conversations WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1", db_cust3_id) if db_cust3_id else None
    print("TEST 5 SENSITIVE CONV:")
    print(dict(last_conv) if last_conv else "None")
    
    await conn.close()

asyncio.run(run())
