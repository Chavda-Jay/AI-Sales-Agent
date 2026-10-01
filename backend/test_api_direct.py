import asyncio
import asyncpg
sys = __import__('sys')
sys.path.append(r'c:\Users\Saubhagyam\ai-sales-agent\backend')
import main

async def run_direct():
    main.db_pool = await asyncpg.create_pool('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', statement_cache_size=0)
    
    req = main.ContentIdeaRequest(business_slug='urban-threads', product_name='All Products', content_type='Mix')
    admin = {'role': 'admin'}
    
    try:
        res = await main.generate_content_ideas(req, admin)
        import json
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await main.db_pool.close()

asyncio.run(run_direct())
