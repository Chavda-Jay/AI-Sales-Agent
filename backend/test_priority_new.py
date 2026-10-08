import urllib.request, json
import asyncio, asyncpg
import os

BASE = "http://127.0.0.1:3001"

def get_token():
    req = urllib.request.Request(BASE + "/api/admin/login", data=json.dumps({"email": "superadmin@ai-sales.com", "password": "admin123"}).encode('utf-8'), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())['token']

TOKEN = get_token()
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

def request(url):
    req = urllib.request.Request(BASE + url, headers=HEADERS)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read())

async def main():
    conn = await asyncpg.connect("postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres", statement_cache_size=0)
    
    print("\n--- 1. Verification of opted_out for ID 139 ---")
    row = await conn.fetchrow("SELECT id, opted_out FROM customers WHERE id = 139")
    print(f"Customer 139: {dict(row)}")

    print("\n--- 3. Scoping Proof ---")
    res_sharma = request("/api/priority-queue?shop=sharma-electronics")
    sharma_ids = [o['customer_id'] for o in res_sharma.get('opportunities', [])]
    print(f"sharma-electronics IDs: {sharma_ids}")

    res_urban = request("/api/priority-queue?shop=urban-threads")
    urban_ids = [o['customer_id'] for o in res_urban.get('opportunities', [])]
    print(f"urban-threads IDs: {urban_ids}")

    urban_b_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = 'urban-threads'")
    sharma_b_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = 'sharma-electronics'")
    
    invalid_urban_ids = await conn.fetch(f"SELECT id FROM customers WHERE id = ANY($1::int[]) AND business_id != {urban_b_id}", urban_ids)
    print(f"Are there any IDs in urban list that do not belong to urban-threads? {len(invalid_urban_ids) > 0}")

    print("\n--- Empty Shop Check ---")
    res_empty = request("/api/priority-queue?shop=ghost-shop")
    print(f"ghost-shop opportunities count: {len(res_empty.get('opportunities', []))}")

    print("\n--- 4. Full JSON for sharma-electronics (Top 10) ---")
    print(json.dumps(res_sharma, indent=2))
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
