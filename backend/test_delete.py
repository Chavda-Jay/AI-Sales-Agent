import asyncio
import asyncpg

async def test_delete():
    conn = await asyncpg.connect('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', statement_cache_size=0)
    try:
        customer_id = 135
        await conn.execute('DELETE FROM conversations WHERE customer_id = $1', customer_id)
        await conn.execute('DELETE FROM retention_stages WHERE customer_id = $1', customer_id)
        await conn.execute('DELETE FROM referrals WHERE referrer_customer_id = $1 OR referred_customer_id = $1', customer_id)
        await conn.execute('DELETE FROM reviews WHERE customer_id = $1', customer_id)
        await conn.execute('DELETE FROM orders WHERE customer_id = $1', customer_id)
        await conn.execute('DELETE FROM handoffs WHERE customer_id = $1', customer_id)
        await conn.execute('DELETE FROM wishlist_items WHERE customer_id = $1', customer_id)
        await conn.execute('DELETE FROM customers WHERE id = $1', customer_id)
        print('Delete Successful')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'Error: {e}')
    finally:
        await conn.close()

asyncio.run(test_delete())
