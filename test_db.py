import asyncio
import asyncpg

async def test():
    try:
        conn = await asyncpg.connect('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres')
        print('SUCCESS', await conn.fetchval('SELECT 1'))
    except Exception as e:
        print('ERROR', e)

asyncio.run(test())
