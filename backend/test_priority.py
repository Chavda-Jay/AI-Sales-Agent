import urllib.request, json
import asyncio, asyncpg

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
    print("--- 1. Calling /api/priority-queue?shop=sharma-electronics ---")
    res1 = request("/api/priority-queue?shop=sharma-electronics")
    print(json.dumps(res1, indent=2))
    print()

    if res1.get('opportunities'):
        print("--- 2. Validating Top 3 scores manually ---")
        for opp in res1['opportunities'][:3]:
            f = opp['factors']
            pi, cf, er, pr, ur = f['purchase_intent'], f['customer_fit'], f['expected_revenue'], f['probability'], f['urgency']
            calc = round(pi * cf * er * pr * ur, 2)
            print(f"{opp['name']} -> {pi} * {cf} * {er} * {pr} * {ur} = {calc} (API says: {opp['priority_score']}) MATCH: {calc == opp['priority_score']}")
        
        print("\n--- 3. Confirming Descending Order ---")
        scores = [o['priority_score'] for o in res1['opportunities']]
        is_desc = all(scores[i] >= scores[i+1] for i in range(len(scores)-1))
        print(f"Scores: {scores} -> Is Descending? {is_desc}")

        print("\n--- 4. Setting opted_out=TRUE for top customer ---")
        top_customer = res1['opportunities'][0]['customer_id']
        conn = await asyncpg.connect("postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres")
        await conn.execute("UPDATE customers SET opted_out = TRUE WHERE id = $1", top_customer)
        
        res2 = request("/api/priority-queue?shop=sharma-electronics")
        is_missing = not any(o['customer_id'] == top_customer for o in res2['opportunities'])
        print(f"Customer {top_customer} missing after opted_out=TRUE? {is_missing}")

        await conn.execute("UPDATE customers SET opted_out = FALSE WHERE id = $1", top_customer)
        await conn.close()

    print("\n--- 5. Calling for urban-threads ---")
    res_urban = request("/api/priority-queue?shop=urban-threads")
    print(f"Returned {len(res_urban.get('opportunities', []))} customers.")

    print("\n--- 6. Calling for non-existent shop ---")
    res_empty = request("/api/priority-queue?shop=ghost-shop")
    print(f"Returned {len(res_empty.get('opportunities', []))} customers.")

    print("\n--- 7. Regression check ---")
    try:
        report = request("/api/daily-report?shop=sharma-electronics&date=2026-10-08")
        print("Daily report OK. Keys:", list(report.keys()))
        analytics = request("/api/analytics?shop=sharma-electronics")
        print("Analytics OK. Keys:", list(analytics.keys()))
    except Exception as e:
        print("Regression failed:", e)

if __name__ == '__main__':
    asyncio.run(main())
