import asyncio
import asyncpg
async def main():
    conn = await asyncpg.connect('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', statement_cache_size=0)
    # business_id for urban-threads is 2
    r1 = await conn.fetch('''
        SELECT ci.name, COUNT(*) as cnt FROM orders o 
        JOIN catalog_items ci ON ci.id = o.product_id
        WHERE o.status = 'confirmed' AND ci.business_id = 2 
        GROUP BY ci.name ORDER BY cnt DESC LIMIT 3
    ''')
    r2 = await conn.fetch('''
        SELECT review_text FROM reviews 
        WHERE business_id = 2 ORDER BY created_at DESC LIMIT 3
    ''')
    r3 = await conn.fetch('''
        SELECT DISTINCT objection FROM handoffs h 
        JOIN customers c ON c.id = h.customer_id
        WHERE c.business_id = 2 AND objection IS NOT NULL 
        ORDER BY objection DESC LIMIT 3
    ''')
    print('bestsellers:', [dict(x) for x in r1])
    print('reviews:', [dict(x) for x in r2])
    print('objections:', [dict(x) for x in r3])
    await conn.close()
asyncio.run(main())
