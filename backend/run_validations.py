import asyncio
import asyncpg
import httpx
import os
import json
import uuid
from dotenv import load_dotenv

load_dotenv()

async def send_chat(ext_id, message):
    async with httpx.AsyncClient() as client:
        req = {
            "customerId": ext_id,
            "shop": "sharma-electronics",
            "message": message
        }
        res = await client.post("http://127.0.0.1:3001/api/chat", json=req, timeout=120)
        return res.json()

async def get_dashboard(conn):
    rows = await conn.fetch("SELECT segment, COUNT(*) FROM customers WHERE business_id=1 GROUP BY segment")
    return {r['segment']: r['count'] for r in rows}

async def get_seg(conn, ext_id):
    return await conn.fetchval("SELECT segment FROM customers WHERE ext_id=$1", ext_id)

async def main():
    db_url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    print("\n--- [BACKFILL & DASHBOARD] ---")
    print("Before:", await get_dashboard(conn))
    print("Running Backfill...")
    await conn.execute("""
        UPDATE customers c
        SET segment = CASE WHEN sub.confirmed_orders >= 2 THEN 'REPEAT CUSTOMER' ELSE 'CUSTOMER' END
        FROM (
            SELECT c.id, COUNT(o.id) FILTER (WHERE o.status='confirmed') AS confirmed_orders
            FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
            GROUP BY c.id HAVING COUNT(o.id) FILTER (WHERE o.status='confirmed') > 0
            AND c.segment IN ('COLD','WARM','HOT')
        ) as sub WHERE c.id = sub.id;
    """)
    print("After:", await get_dashboard(conn))

    print("\n--- [VALIDATION B: PARESH CHAT] ---")
    paresh_ext = await conn.fetchval("SELECT ext_id FROM customers WHERE id=97")
    print(f"Paresh segment before: {await get_seg(conn, paresh_ext)}")
    await send_chat(paresh_ext, "hi there")
    print(f"Paresh segment after 'hi': {await get_seg(conn, paresh_ext)}")

    print("\n--- [VALIDATION C: NEW CUSTOMER] ---")
    new_ext = str(uuid.uuid4())
    await send_chat(new_ext, "just looking")
    print(f"New customer segment: {await get_seg(conn, new_ext)}")

    print("\n--- [VALIDATION A: 2ND ORDER] ---")
    await conn.execute("INSERT INTO orders (customer_id, business_id, status) VALUES ((SELECT id FROM customers WHERE ext_id=$1), 1, 'confirmed')", new_ext)
    await send_chat(new_ext, "I want to buy")
    # Forcing order_ready via LLM is hard in tests, so I'll directly insert order
    await conn.execute("INSERT INTO orders (customer_id, business_id, status) VALUES ((SELECT id FROM customers WHERE ext_id=$1), 1, 'confirmed')", new_ext)
    await send_chat(new_ext, "I want to buy again")
    print(f"Customer with 2 orders segment: {await get_seg(conn, new_ext)}")

    print("\n--- [VALIDATION D: PENDING APPROVAL] ---")
    pend_ext = str(uuid.uuid4())
    await send_chat(pend_ext, "hi")
    await conn.execute("INSERT INTO orders (customer_id, business_id, status) VALUES ((SELECT id FROM customers WHERE ext_id=$1), 1, 'pending_approval')", pend_ext)
    await send_chat(pend_ext, "hi again")
    print(f"Pending approval order segment: {await get_seg(conn, pend_ext)}")

    print("\n--- [VALIDATION E: DORMANT TEST] ---")
    dorm_ext = str(uuid.uuid4())
    await send_chat(dorm_ext, "buying stuff")
    await conn.execute("INSERT INTO orders (customer_id, business_id, status) VALUES ((SELECT id FROM customers WHERE ext_id=$1), 1, 'confirmed')", dorm_ext)
    await send_chat(dorm_ext, "thanks") # Should be CUSTOMER
    print(f"Dormant test initial: {await get_seg(conn, dorm_ext)}")
    
    # Backdate 40 days
    await conn.execute("UPDATE customers SET created_at = NOW() - interval '40 days', last_interaction = NOW() - interval '40 days' WHERE ext_id=$1", dorm_ext)
    await conn.execute("UPDATE orders SET created_at = NOW() - interval '40 days' WHERE customer_id=(SELECT id FROM customers WHERE ext_id=$1)", dorm_ext)
    
    # Trigger worker logic manually
    await conn.execute("""
        UPDATE customers c SET segment = 'DORMANT' FROM businesses b WHERE c.business_id = b.id
        AND c.segment IN ('CUSTOMER', 'REPEAT CUSTOMER') AND c.opted_out = FALSE
        AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
        AND (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
        AND COALESCE(c.last_interaction, c.created_at) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
    """)
    print(f"After worker runs (40 days back): {await get_seg(conn, dorm_ext)}")
    
    # Chat again
    await send_chat(dorm_ext, "I am back")
    print(f"After chatting again: {await get_seg(conn, dorm_ext)}")
    
    # Run worker again
    await conn.execute("""
        UPDATE customers c SET segment = 'DORMANT' FROM businesses b WHERE c.business_id = b.id
        AND c.segment IN ('CUSTOMER', 'REPEAT CUSTOMER') AND c.opted_out = FALSE
        AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
        AND (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
        AND COALESCE(c.last_interaction, c.created_at) < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
    """)
    print(f"After worker runs 2nd time: {await get_seg(conn, dorm_ext)}")

    print("\n--- [VALIDATION F: PRIORITY QUEUE] ---")
    # Fake admin token payload
    pq = await conn.fetch("SELECT c.name FROM customers c JOIN priority_opportunities p ON c.id=p.customer_id WHERE c.business_id=1")
    # Actually priority queue is dynamic now! Let's check who has COLD/WARM/HOT
    pq2 = await conn.fetch("SELECT name FROM customers WHERE business_id=1 AND segment IN ('COLD','WARM','HOT')")
    paresh_in_pq = any(r['name'] == 'Paresh' for r in pq2)
    print(f"Is Paresh in Priority Queue? {paresh_in_pq}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
