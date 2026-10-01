import asyncio
import asyncpg
sys = __import__('sys')
sys.path.append(r'c:\Users\Saubhagyam\ai-sales-agent\backend')
import main

async def run_direct():
    main.db_pool = await asyncpg.create_pool('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', statement_cache_size=0)
    
    # We will test chat by creating a request for urban-threads
    req = main.ChatRequest(customerId='test-customer-999', message='delivery kab tak hogi?', shop='urban-threads')
    
    try:
        # Before calling chat, we might need to initialize the global db_pool
        res = await main.chat(req)
        import json
        with open('chat_out.txt', 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=2, ensure_ascii=False)
    except Exception as e:
        with open('chat_out.txt', 'w', encoding='utf-8') as f:
            f.write(f"Error: {e}")
    finally:
        await main.db_pool.close()

asyncio.run(run_direct())
