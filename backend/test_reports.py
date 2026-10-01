import asyncio
import asyncpg
import sys
import os
import json
from datetime import datetime

sys.path.append(r'c:\Users\Saubhagyam\ai-sales-agent\backend')
import main

async def test():
    db_url = 'postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
    main.db_pool = await asyncpg.create_pool(db_url, statement_cache_size=0)
    
    # Init table just in case the server hasn't restarted yet
    async with main.db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS daily_reports (
                id SERIAL PRIMARY KEY,
                business_id INT REFERENCES businesses(id),
                report_date DATE,
                report_type TEXT,
                data JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(business_id, report_date, report_type)
            )
        """)
    
    admin_mock = {}
    
    print("--- 1. POST generate-now ---")
    try:
        res1 = await main.generate_daily_report_now('sharma-electronics', 'morning', admin_mock)
        print(json.dumps(res1, default=str, indent=2))
    except Exception as e:
        print(f"Failed: {e}")
        
    print("\n--- 2. SQL SELECT ---")
    async with main.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM daily_reports ORDER BY id DESC LIMIT 3")
        for r in rows:
            print(dict(r))
            
    print("\n--- 3. DUPLICATE POST generate-now ---")
    try:
        res3 = await main.generate_daily_report_now('sharma-electronics', 'morning', admin_mock)
        print(json.dumps(res3, default=str, indent=2))
    except Exception as e:
        print(f"Failed: {e}")
        
    print("\n--- 4. GET history ---")
    try:
        res4 = await main.get_daily_reports_history('sharma-electronics', admin_mock)
        print(json.dumps(res4, default=str, indent=2))
    except Exception as e:
        print(f"Failed: {e}")
        
    print("\n--- 5. GET old daily report endpoint ---")
    try:
        res5 = await main.get_daily_report('sharma-electronics', None, admin_mock)
        print(json.dumps(res5, default=str, indent=2))
    except Exception as e:
        print(f"Failed: {e}")
        
    await main.db_pool.close()

if __name__ == '__main__':
    asyncio.run(test())
