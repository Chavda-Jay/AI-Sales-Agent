import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def run():
    print("--- Connecting to Database ---")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        # 1. Verify schema
        col_type = await conn.fetchval("""
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'businesses' AND column_name = 'welcome_bonus_amount'
        """)
        print(f"[TEST 1] businesses.welcome_bonus_amount column exists: {col_type is not None} ({col_type})")
        assert col_type is not None, "welcome_bonus_amount column missing"

        # 2. Check sharma-electronics bonus
        biz = await conn.fetchrow("SELECT id, slug, welcome_bonus_amount FROM businesses WHERE slug = 'sharma-electronics'")
        assert biz is not None, "sharma-electronics not found"
        print(f"[TEST 2] sharma-electronics welcome_bonus_amount: {biz['welcome_bonus_amount']}")

        # Ensure it has 100
        await conn.execute("UPDATE businesses SET welcome_bonus_amount = 100.0 WHERE slug = 'sharma-electronics'")

        # 3. Clean up any previous test customer
        test_phone = "9988776655"
        test_ext = "test-welcome-ext-1"
        test_ext2 = "test-welcome-ext-2"
        await conn.execute("""
            DELETE FROM consent_logs WHERE customer_id IN (
                SELECT id FROM customers WHERE phone = $1 OR ext_id IN ($2, $3)
            )
        """, test_phone, test_ext, test_ext2)
        await conn.execute("""
            DELETE FROM wallet_transactions WHERE customer_id IN (
                SELECT id FROM customers WHERE phone = $1 OR ext_id IN ($2, $3)
            )
        """, test_phone, test_ext, test_ext2)
        await conn.execute("DELETE FROM customers WHERE phone = $1 OR ext_id IN ($2, $3)", test_phone, test_ext, test_ext2)

        # 4. Simulate onboarding customer 1
        import urllib.request
        import json

        base_url = "http://127.0.0.1:3001"

        req_data = json.dumps({
            "customerId": test_ext,
            "name": "Test Onboard User",
            "phone": test_phone,
            "city": "Surat",
            "delivery_address": "Surat, Gujarat",
            "consent_whatsapp": True
        }).encode('utf-8')

        req = urllib.request.Request(
            f"{base_url}/api/store/onboard?shop=sharma-electronics",
            data=req_data,
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"[TEST 3] First Onboard Response: {data['status']} | Awarded: {data.get('welcome_bonus_awarded')} | Amount: {data.get('welcome_bonus_amount')}")
            assert data["welcome_bonus_awarded"] == True
            assert float(data["welcome_bonus_amount"]) == 100.0
            cust_id = data["customer"]["id"]

        # Check DB wallet transactions and consent log
        wt_count = await conn.fetchval(
            "SELECT count(*) FROM wallet_transactions WHERE customer_id = $1 AND kind = 'welcome_bonus'",
            cust_id
        )
        print(f"[TEST 4] Wallet transactions with welcome_bonus count: {wt_count}")
        assert wt_count == 1, "Expected exactly 1 welcome_bonus transaction"

        consent_reason = await conn.fetchval(
            "SELECT reason FROM consent_logs WHERE customer_id = $1 ORDER BY id DESC LIMIT 1",
            cust_id
        )
        print(f"[TEST 5] Consent log reason: '{consent_reason}'")
        assert consent_reason == "self-declared, unverified", f"Expected 'self-declared, unverified', got '{consent_reason}'"

        # 5. Deduplication test: Try to onboard again with the SAME phone number but different browser/ext_id
        req_data2 = json.dumps({
            "customerId": test_ext2,
            "name": "Test Onboard Duplicate Phone",
            "phone": test_phone,
            "city": "Surat",
            "delivery_address": "Surat, Gujarat",
            "consent_whatsapp": True
        }).encode('utf-8')

        req2 = urllib.request.Request(
            f"{base_url}/api/store/onboard?shop=sharma-electronics",
            data=req_data2,
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req2) as resp2:
            data2 = json.loads(resp2.read().decode())
            print(f"[TEST 6] Duplicate Phone Onboard Response: {data2['status']} | Awarded: {data2.get('welcome_bonus_awarded')} | Amount: {data2.get('welcome_bonus_amount')}")
            assert data2["welcome_bonus_awarded"] == False, "Deduplication failed! Bonus was awarded to same phone twice."
            assert float(data2.get("welcome_bonus_amount", 0)) == 0.0

        # Total welcome_bonus transactions for this phone should still be 1!
        total_wb = await conn.fetchval(
            """
            SELECT count(*) FROM wallet_transactions wt
            JOIN customers c ON c.id = wt.customer_id
            WHERE c.phone = $1 AND wt.kind = 'welcome_bonus'
            """,
            test_phone
        )
        print(f"[TEST 7] Total welcome bonus transactions for phone {test_phone}: {total_wb}")
        assert total_wb == 1, "Phone was credited welcome bonus more than once!"

        # 6. Clean up test data
        await conn.execute("""
            DELETE FROM consent_logs WHERE customer_id IN (
                SELECT id FROM customers WHERE phone = $1 OR ext_id IN ($2, $3)
            )
        """, test_phone, test_ext, test_ext2)
        await conn.execute("""
            DELETE FROM wallet_transactions WHERE customer_id IN (
                SELECT id FROM customers WHERE phone = $1 OR ext_id IN ($2, $3)
            )
        """, test_phone, test_ext, test_ext2)
        await conn.execute("DELETE FROM customers WHERE phone = $1 OR ext_id IN ($2, $3)", test_phone, test_ext, test_ext2)

        print("\n==========================================")
        print("ALL 7 TESTS PASSED SUCCESSFULLY! ZERO ERRORS.")
        print("==========================================")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
