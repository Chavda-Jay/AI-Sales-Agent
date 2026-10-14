import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)

    target_ids = [162, 163]

    print("=== FINAL CLEANUP SELECT ===")
    
    # Check referrals using correct column
    refs = await conn.fetchval("SELECT COUNT(*) FROM referrals WHERE referred_customer_id = ANY($1::int[]) OR referrer_customer_id = ANY($1::int[])", target_ids)
    
    tables_to_check = ['retention_stages', 'handoffs', 'wishlist_items', 'reviews']
    counts = {"referrals": refs}
    for t in tables_to_check:
        try:
            c = await conn.fetchval(f"SELECT COUNT(*) FROM {t} WHERE customer_id = ANY($1::int[])", target_ids)
            counts[t] = c
        except Exception:
            pass
            
    print(f"Additional related rows: {counts}")
    
    print("\n=== RUNNING CLEANUP TRANSACTION ===")
    async with conn.transaction():
        # Order of deletion is important for foreign keys
        del_conv = await conn.execute("DELETE FROM conversations WHERE customer_id = ANY($1::int[])", target_ids)
        del_orders = await conn.execute("DELETE FROM orders WHERE customer_id = ANY($1::int[])", target_ids)
        del_cust = await conn.execute("DELETE FROM customers WHERE id = ANY($1::int[])", target_ids)
        print(f"Deleted conversations: {del_conv}")
        print(f"Deleted orders: {del_orders}")
        print(f"Deleted customers: {del_cust}")
        
    print("\n=== DASHBOARD NUMBERS AFTER CLEANUP ===")
    # Total customers
    total_c = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE business_id = 1")
    # Orders placed
    orders_p = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE business_id = 1 AND status = 'confirmed'")
    
    # Repeat buyers
    repeat_buyers = await conn.fetchval("""
        SELECT COUNT(*) FROM (
            SELECT customer_id FROM orders 
            WHERE business_id = 1 AND status = 'confirmed' 
            GROUP BY customer_id HAVING COUNT(*) > 1
        ) as sub
    """) or 0
    buyers = await conn.fetchval("SELECT COUNT(DISTINCT customer_id) FROM orders WHERE business_id = 1 AND status = 'confirmed'") or 1
    
    segments = await conn.fetch("SELECT segment, COUNT(*) FROM customers WHERE business_id = 1 GROUP BY segment")
    seg_dict = {s['segment']: s['count'] for s in segments}

    print(f"Total customers: {total_c}")
    print(f"Orders placed: {orders_p}")
    print(f"Repeat purchase rate: {round((repeat_buyers / buyers) * 100, 2)}% ({repeat_buyers}/{buyers})")
    print(f"Segment breakdown: {seg_dict}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
