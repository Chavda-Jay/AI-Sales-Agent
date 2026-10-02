import asyncio
import httpx
import time
import json
import os

BASE_URL = "http://127.0.0.1:3001"
SLUG = "urban-threads" # Assuming this is a valid slug
PHONE = "9999999999" # test phone

async def run_tests():
    from dotenv import load_dotenv
    load_dotenv()
    # Find a business and an admin token
    import asyncpg
    db_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    # 1. Get a business
    business = await conn.fetchrow("SELECT id, slug FROM businesses LIMIT 1")
    slug = business['slug']
    business_id = business['id']

    # Get admin token for this business
    import jwt
    token = jwt.encode({"business_id": business_id, "role": "admin"}, os.getenv("SECRET_KEY", "your-secret-key"), algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    print(f"Testing for business: {slug}")

    # 1. Set Threshold to 50000
    print("\n--- TEST 1: SET THRESHOLD ---")
    async with httpx.AsyncClient() as client:
        # Get context
        res = await client.get(f"{BASE_URL}/api/businesses/{slug}/context", headers=headers)
        context = res.json()
        context['high_value_order_threshold'] = 50000
        # Update context
        res = await client.put(f"{BASE_URL}/api/businesses/{slug}/context", headers=headers, json=context)
        print("Set threshold to 50000:", res.json())

    # Wait a sec
    await asyncio.sleep(1)
    
    # 2. Place high value order
    print("\n--- TEST 2: HIGH VALUE ORDER ---")
    # Clean previous state for phone
    await conn.execute("DELETE FROM customers WHERE phone = $1", PHONE)
    
    async with httpx.AsyncClient() as client:
        # Initial message to create customer
        await client.post(f"{BASE_URL}/api/chat", json={"shop": slug, "customerPhone": PHONE, "message": "Hi"})
        
        # Fake a system prompt completion that sets order_ready and amount > 50000
        # Since we can't easily force the LLM, we will directly update the backend by mocking a chat payload or just inserting directly?
        # Actually, let's force the LLM by giving it an explicit system prompt? No, we can just say we are buying 100 laptops.
        print("Sending message to place large order...")
        res = await client.post(f"{BASE_URL}/api/chat", json={"shop": slug, "customerPhone": PHONE, "message": "I want to place an order for 60000 rupees.", "test_override": True}, timeout=30.0)
        # Wait, the LLM will reply. I might need a few messages to get `order_ready`.
        # Instead, let's just create an endpoint or script to simulate the `/api/chat` order placement, or directly call the logic.
        
    await conn.close()

asyncio.run(run_tests())
