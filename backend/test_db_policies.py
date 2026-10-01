import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', statement_cache_size=0)
    business = await conn.fetchrow("SELECT policies FROM businesses WHERE slug = 'urban-threads'")
    with open('policies.txt', 'w', encoding='utf-8') as f:
        f.write(business['policies'])
    await conn.close()

asyncio.run(main())
