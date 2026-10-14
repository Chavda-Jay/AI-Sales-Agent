import asyncio
import asyncpg
import httpx
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

async def send_chat_with_retry(ext_id, message):
    async with httpx.AsyncClient() as client:
        for attempt in range(5):
            try:
                print(f"  [API] Sending chat for {ext_id} (Attempt {attempt+1})...")
                res = await client.post(
                    "http://127.0.0.1:3001/api/chat", 
                    json={"customerId": ext_id, "shop": "sharma-electronics", "message": message},
                    timeout=300
                )
                if res.status_code == 200:
                    print(f"  [API] Success.")
                    return res.json()
                elif res.status_code == 429:
                    print("  [API] Rate limited. Waiting 10s...")
                    await asyncio.sleep(10)
                else:
                    print(f"  [API] Error {res.status_code}: {res.text}")
                    await asyncio.sleep(5)
            except Exception as e:
                print(f"  [API] Exception: {e}")
                await asyncio.sleep(5)
    return None

async def main():
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)

    print("\n================= TEST E: DORMANT LOOP =================")
    c162 = await conn.fetchrow("SELECT id, ext_id, created_at, last_interaction, segment FROM customers WHERE id = 162")
    if not c162:
        print("ERROR: Customer 162 not found.")
        return
    print(f"1. Before Backdate:")
    print(f"   Customer: {dict(c162)}")
    orders_before = await conn.fetch("SELECT id, created_at FROM orders WHERE customer_id = 162")
    print(f"   Orders: {[dict(o) for o in orders_before]}")

    print("\n   [Backdating 40 days...]")
    await conn.execute("UPDATE customers SET created_at = created_at - INTERVAL '40 days', last_interaction = COALESCE(last_interaction, created_at) - INTERVAL '40 days' WHERE id = 162")
    await conn.execute("UPDATE orders SET created_at = created_at - INTERVAL '40 days' WHERE customer_id = 162")

    c162_after = await conn.fetchrow("SELECT id, created_at, last_interaction, segment FROM customers WHERE id = 162")
    orders_after = await conn.fetch("SELECT id, created_at FROM orders WHERE customer_id = 162")
    print(f"   After Backdate:")
    print(f"   Customer: {dict(c162_after)}")
    print(f"   Orders: {[dict(o) for o in orders_after]}")

    print("\n2. Running dormant_customer_worker UPDATE (Target: id=162)")
    res_dormant = await conn.fetch("""
        UPDATE customers c SET segment = 'DORMANT'
        FROM businesses b WHERE c.business_id = b.id
        AND c.id = 162
        AND c.segment IN ('CUSTOMER', 'REPEAT CUSTOMER') AND c.opted_out = FALSE
        AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
        AND (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
        AND COALESCE(c.last_interaction, c.created_at) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
        RETURNING c.id, c.segment
    """)
    print(f"   Worker Result: {[dict(r) for r in res_dormant]}")

    print("\n3. Chatting from customer 162: 'I am back'")
    await send_chat_with_retry(c162['ext_id'], "I am back")
    c162_post_chat = await conn.fetchrow("SELECT segment, last_interaction FROM customers WHERE id = 162")
    print(f"   DB State After Chat: Segment={c162_post_chat['segment']}, LastInteraction={c162_post_chat['last_interaction']}")

    print("\n4. Running dormant_customer_worker UPDATE again (Target: id=162)")
    res_dormant_2 = await conn.fetch("""
        UPDATE customers c SET segment = 'DORMANT'
        FROM businesses b WHERE c.business_id = b.id
        AND c.id = 162
        AND c.segment IN ('CUSTOMER', 'REPEAT CUSTOMER') AND c.opted_out = FALSE
        AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
        AND (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
        AND COALESCE(c.last_interaction, c.created_at) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
        RETURNING c.id, c.segment
    """)
    print(f"   Worker Result (2nd run): {[dict(r) for r in res_dormant_2]}")

    print("\n================= TEST D: PENDING APPROVAL =================")
    print("1. Inserting qa-pending-test-1")
    ext_d = 'qa-pending-test-1'
    # Delete if exists
    await conn.execute("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE ext_id=$1)", ext_d)
    await conn.execute("DELETE FROM customers WHERE ext_id=$1", ext_d)
    
    id_d = await conn.fetchval("INSERT INTO customers (ext_id, business_id, name, segment) VALUES ($1, 1, 'QA Test', 'COLD') RETURNING id", ext_d)
    await conn.execute("INSERT INTO orders (customer_id, business_id, status, amount) VALUES ($1, 1, 'pending_approval', 80000)", id_d)
    
    cD_before = await conn.fetchrow("SELECT id, segment, (SELECT COUNT(*) FROM orders WHERE customer_id=$1 AND status='confirmed') as conf_orders FROM customers WHERE id=$1", id_d)
    print(f"   DB State Before: {dict(cD_before)}")

    print("\n2. Chatting from qa-pending-test-1: 'hi, just checking'")
    await send_chat_with_retry(ext_d, "hi, just checking")
    cD_after = await conn.fetchrow("SELECT segment FROM customers WHERE id=$1", id_d)
    print(f"3. DB State After Chat: Segment={cD_after['segment']}")

    print("\n================= CLEANUP INFO =================")
    print(f"Target IDs for cleanup: 162, {id_d}")
    target_ids = [162, id_d]
    
    customers_to_delete = await conn.fetch("SELECT id, ext_id, segment FROM customers WHERE id = ANY($1::int[])", target_ids)
    print(f"Customers to delete: {[dict(c) for c in customers_to_delete]}")
    
    tables_to_check = ['orders', 'conversations', 'referrals', 'retention_stages', 'handoffs', 'wishlist_items', 'reviews']
    for t in tables_to_check:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {t} WHERE customer_id = ANY($1::int[])", target_ids)
        print(f"{t}: {count} rows")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
