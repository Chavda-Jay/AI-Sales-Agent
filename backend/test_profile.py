import os
import urllib.request
import urllib.error
import json
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def main():
    # 1. Connect to DB to get any customer ID
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'), statement_cache_size=0)
    customer = await conn.fetchrow("SELECT id, name FROM customers LIMIT 1")
    await conn.close()
    
    if not customer:
        print("No customers found in database.")
        return
        
    customer_id = customer['id']
    customer_name = customer['name']
    
    # 2. Generate token directly
    print("Generating admin token...")
    import jwt
    token = jwt.encode({"role": "admin", "business_id": 1}, os.getenv("JWT_SECRET_KEY", "super-secret-default-key-for-demo"), algorithm="HS256")
    
    # 3. Call the new unified profile endpoint
    print(f"\nFetching Unified Profile for Customer: {customer_name} (ID: {customer_id})...")
    req = urllib.request.Request(
        f"http://127.0.0.1:3001/api/customers/{customer_id}/profile",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print("\n--- JSON RESPONSE FROM NEW /profile API ---")
            print(json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode()}")
    except urllib.error.URLError as e:
        print(f"URL Error: Backend uvicorn server must be running. Failed to connect: {e.reason}")
    
if __name__ == "__main__":
    asyncio.run(main())
