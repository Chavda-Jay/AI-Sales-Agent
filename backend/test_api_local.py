import asyncio
import asyncpg
sys = __import__('sys')
sys.path.append(r'c:\Users\Saubhagyam\ai-sales-agent\backend')
from main import generate_content_ideas, ContentIdeaRequest, init_db, db_pool

async def main():
    await init_db()
    req = ContentIdeaRequest(business_slug='urban-threads', product_name='All Products', content_type='Mix')
    admin = {'role': 'admin'}
    res = await generate_content_ideas(req, admin)
    import json
    print(json.dumps(res, indent=2))
    import main
    await main.db_pool.close()

asyncio.run(main())
