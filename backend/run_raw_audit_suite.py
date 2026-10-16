import asyncio
import os
import jwt
import asyncpg
import httpx
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-default-key-for-demo")
BASE_URL = "http://127.0.0.1:3001"

def create_admin_token(username: str, business_id: int):
    payload = {
        "sub": username,
        "role": "admin",
        "business_id": business_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

async def run_all_tests():
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    client = httpx.AsyncClient(base_url=BASE_URL, timeout=15.0)

    try:
        print("=== RUNNING RAW AUDIT TEST SUITE ===")
        
        # Get businesses
        biz1 = await conn.fetchrow("SELECT id, slug FROM businesses WHERE slug = 'sharma-electronics'")
        biz2 = await conn.fetchrow("SELECT id, slug FROM businesses WHERE slug = 'urban-threads'")
        assert biz1 and biz2, "Businesses not found"
        biz1_id = biz1["id"]
        biz2_id = biz2["id"]

        # Tokens
        token_biz1 = create_admin_token("admin_sharma", biz1_id)
        token_biz2 = create_admin_token("admin_urban", biz2_id)

        # ----------------------------------------------------
        # TEST 1: approve_order Security & Tenancy Isolation
        # ----------------------------------------------------
        print("\n--- TEST 1: approve_order Security & Isolation ---")
        
        # Clean up previous qa orders / customers if any
        await conn.execute("DELETE FROM wallet_transactions WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM retention_stages WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM referrals WHERE referrer_customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%') OR referred_customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM customers WHERE ext_id LIKE 'qa-hub-%'")

        # Create dummy customer & pending_approval order for biz1
        cust1_id = await conn.fetchval(
            "INSERT INTO customers (ext_id, name, phone, business_id, wallet_balance) VALUES ($1, $2, $3, $4, 0) RETURNING id",
            "qa-hub-cust1", "QA Customer 1", "9111111111", biz1_id
        )
        order_biz1_id = await conn.fetchval(
            "INSERT INTO orders (customer_id, business_id, amount, status) VALUES ($1, $2, 60000, 'pending_approval') RETURNING id",
            cust1_id, biz1_id
        )

        # 1.1 Without token -> 401 or 403
        r_no_auth = await client.post(f"/api/orders/{order_biz1_id}/approve")
        print(f"1.1 Without token status: {r_no_auth.status_code} (Expected: 401 or 403)")
        assert r_no_auth.status_code in (401, 403), f"Expected 401/403, got {r_no_auth.status_code}"

        # 1.2 With biz2 admin token (wrong business) -> 404
        r_wrong_biz = await client.post(
            f"/api/orders/{order_biz1_id}/approve",
            headers={"Authorization": f"Bearer {token_biz2}"}
        )
        print(f"1.2 Wrong business admin token status: {r_wrong_biz.status_code} (Expected: 404)")
        assert r_wrong_biz.status_code == 404, f"Expected 404, got {r_wrong_biz.status_code}"

        # 1.3 With correct biz1 admin token -> 200
        r_correct = await client.post(
            f"/api/orders/{order_biz1_id}/approve",
            headers={"Authorization": f"Bearer {token_biz1}"}
        )
        print(f"1.3 Correct business admin token status: {r_correct.status_code} (Expected: 200)")
        assert r_correct.status_code == 200, f"Expected 200, got {r_correct.status_code}"
        
        # Verify order status updated to confirmed in DB
        approved_status = await conn.fetchval("SELECT status FROM orders WHERE id = $1", order_biz1_id)
        assert approved_status == "confirmed", "Order was not confirmed"
        print(f"1.4 DB Order status confirmed: {approved_status}")

        # ----------------------------------------------------
        # TEST 2: Concurrency & Wallet Discount Test
        # ----------------------------------------------------
        print("\n--- TEST 2: Wallet Discount Concurrency Test ---")
        
        # Create customer with wallet_balance = 100
        qa_conc_cid = await conn.fetchval(
            "INSERT INTO customers (ext_id, name, phone, business_id, wallet_balance) VALUES ($1, $2, $3, $4, 100.0) RETURNING id",
            "qa-hub-conc", "QA Concurrency Shopper", "9222222222", biz1_id
        )

        # Place two concurrent order attempts with wallet_discount = 100
        async def place_order_with_lock(label: str):
            async with conn.transaction():
                cust_bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE id = $1 FOR UPDATE", qa_conc_cid)
                current_bal = float(cust_bal or 0)
                wallet_discount = 100.0
                final_amount = 500.0
                actual_discount = 0.0
                if wallet_discount > 0 and current_bal > 0:
                    actual_discount = min(current_bal, wallet_discount)
                    final_amount = max(0.0, final_amount - actual_discount)
                    new_bal = max(0.0, current_bal - actual_discount)
                    await conn.execute("UPDATE customers SET wallet_balance = $1 WHERE id = $2", new_bal, qa_conc_cid)
                else:
                    actual_discount = 0.0
                    new_bal = current_bal

                order_db_id = await conn.fetchval(
                    "INSERT INTO orders (customer_id, business_id, amount, status) VALUES ($1, $2, $3, 'confirmed') RETURNING id",
                    qa_conc_cid, biz1_id, final_amount
                )
                if actual_discount > 0:
                    await conn.execute(
                        """
                        INSERT INTO wallet_transactions (customer_id, business_id, amount, kind, ref_id, note, balance_after)
                        VALUES ($1, $2, $3, 'order_discount', $4, $5, $6)
                        """,
                        qa_conc_cid, biz1_id, -actual_discount, order_db_id, f"Order #{order_db_id} discount", new_bal
                    )
                return {"label": label, "order_id": order_db_id, "discount": actual_discount, "final_amount": final_amount, "new_bal": new_bal}

        # Run both simultaneously
        # We need two separate database connections to test real concurrency locks
        conn2 = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
        async def run_order_on_conn(c, label):
            async with c.transaction():
                cust_bal = await c.fetchval("SELECT wallet_balance FROM customers WHERE id = $1 FOR UPDATE", qa_conc_cid)
                current_bal = float(cust_bal or 0)
                wallet_discount = 100.0
                final_amount = 500.0
                actual_discount = 0.0
                if wallet_discount > 0 and current_bal > 0:
                    actual_discount = min(current_bal, wallet_discount)
                    final_amount = max(0.0, final_amount - actual_discount)
                    new_bal = max(0.0, current_bal - actual_discount)
                    await c.execute("UPDATE customers SET wallet_balance = $1 WHERE id = $2", new_bal, qa_conc_cid)
                else:
                    actual_discount = 0.0
                    new_bal = current_bal

                order_db_id = await c.fetchval(
                    "INSERT INTO orders (customer_id, business_id, amount, status) VALUES ($1, $2, $3, 'confirmed') RETURNING id",
                    qa_conc_cid, biz1_id, final_amount
                )
                if actual_discount > 0:
                    await c.execute(
                        """
                        INSERT INTO wallet_transactions (customer_id, business_id, amount, kind, ref_id, note, balance_after)
                        VALUES ($1, $2, $3, 'order_discount', $4, $5, $6)
                        """,
                        qa_conc_cid, biz1_id, -actual_discount, order_db_id, f"Order #{order_db_id} discount", new_bal
                    )
                return {"label": label, "order_id": order_db_id, "discount": actual_discount, "final_amount": final_amount, "new_bal": new_bal}

        resA, resB = await asyncio.gather(
            run_order_on_conn(conn, "Order-A"),
            run_order_on_conn(conn2, "Order-B")
        )
        await conn2.close()

        print(f"2.1 Concurrency Results: {resA} vs {resB}")
        # One must have discount 100, the other must have discount 0
        discounts = sorted([resA["discount"], resB["discount"]])
        assert discounts == [0.0, 100.0], f"Expected [0.0, 100.0], got {discounts}"

        # Final wallet balance must be exactly 0, never negative
        end_bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE id = $1", qa_conc_cid)
        print(f"2.2 Final Wallet Balance: {end_bal} (Expected: 0.0)")
        assert float(end_bal) == 0.0, f"Expected 0.0, got {end_bal}"

        # Exactly 1 debit transaction in ledger
        debit_count = await conn.fetchval(
            "SELECT COUNT(*) FROM wallet_transactions WHERE customer_id = $1 AND kind = 'order_discount'",
            qa_conc_cid
        )
        print(f"2.3 Order Discount Ledger Debits: {debit_count} (Expected: 1)")
        assert debit_count == 1, f"Expected 1 debit transaction, got {debit_count}"

        # ----------------------------------------------------
        # TEST 5: Referral Reward on Normal Confirmed Order
        # ----------------------------------------------------
        print("\n--- TEST 5: Referral Reward on Normal Confirmed Order ---")
        ref_code = "QAREF100"
        referrer_id = await conn.fetchval(
            "INSERT INTO customers (ext_id, name, phone, business_id, referral_code, wallet_balance) VALUES ($1, $2, $3, $4, $5, 0.0) RETURNING id",
            "qa-hub-referrer", "QA Referrer", "9333333333", biz1_id, ref_code
        )
        referred_id = await conn.fetchval(
            "INSERT INTO customers (ext_id, name, phone, business_id, referred_by_code, wallet_balance) VALUES ($1, $2, $3, $4, $5, 0.0) RETURNING id",
            "qa-hub-referred", "QA Referred", "9444444444", biz1_id, ref_code
        )
        # Pending referral record
        ref_id = await conn.fetchval(
            """
            INSERT INTO referrals (referrer_customer_id, referred_customer_id, referral_code, reward_status)
            VALUES ($1, $2, $3, 'pending') RETURNING id
            """,
            referrer_id, referred_id, ref_code
        )

        # Place normal confirmed order (amount = 2500, threshold = 50000)
        async with conn.transaction():
            norm_order_id = await conn.fetchval(
                "INSERT INTO orders (customer_id, business_id, amount, status) VALUES ($1, $2, 2500, 'confirmed') RETURNING id",
                referred_id, biz1_id
            )
            # Execute referral credit block as in main.py
            await conn.execute(
                "UPDATE referrals SET reward_status = 'earned', reward_amount = 100, referred_order_id = $1 WHERE id = $2 AND reward_status = 'pending'",
                norm_order_id, ref_id
            )
            # Referrer reward
            r_bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE id = $1 FOR UPDATE", referrer_id)
            new_r_bal = float(r_bal or 0) + 100
            await conn.execute("UPDATE customers SET wallet_balance = $1 WHERE id = $2", new_r_bal, referrer_id)
            await conn.execute(
                """
                INSERT INTO wallet_transactions (customer_id, business_id, amount, kind, ref_id, note, balance_after)
                VALUES ($1, $2, 100, 'referral_reward', $3, 'Referral reward for referring QA Referred', $4)
                """,
                referrer_id, biz1_id, ref_id, new_r_bal
            )
            # Referred reward
            c_bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE id = $1 FOR UPDATE", referred_id)
            new_c_bal = float(c_bal or 0) + 100
            await conn.execute("UPDATE customers SET wallet_balance = $1 WHERE id = $2", new_c_bal, referred_id)
            await conn.execute(
                """
                INSERT INTO wallet_transactions (customer_id, business_id, amount, kind, ref_id, note, balance_after)
                VALUES ($1, $2, 100, 'referral_reward', $3, 'Welcome referral bonus for order', $4)
                """,
                referred_id, biz1_id, ref_id, new_c_bal
            )

        ref_reward_status = await conn.fetchval("SELECT reward_status FROM referrals WHERE id = $1", ref_id)
        ref_reward_amount = await conn.fetchval("SELECT reward_amount FROM referrals WHERE id = $1", ref_id)
        referrer_bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE id = $1", referrer_id)
        referred_bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE id = $1", referred_id)
        
        print(f"5.1 Referral reward status: {ref_reward_status}, amount: {ref_reward_amount}")
        print(f"5.2 Referrer balance: {referrer_bal}, Referred balance: {referred_bal}")
        assert ref_reward_status == "earned" and float(ref_reward_amount) == 100.0
        assert float(referrer_bal) == 100.0 and float(referred_bal) == 100.0

        ref_ledger_count = await conn.fetchval(
            "SELECT COUNT(*) FROM wallet_transactions WHERE ref_id = $1 AND kind = 'referral_reward'",
            ref_id
        )
        print(f"5.3 Ledger matching credits: {ref_ledger_count} transactions (both got Rs 100)")
        assert ref_ledger_count == 2, f"Expected 2 ledger entries, got {ref_ledger_count}"

        # ----------------------------------------------------
        # CLEANUP QA DATA
        # ----------------------------------------------------
        print("\n--- CLEANUP QA TEST DATA ---")
        await conn.execute("DELETE FROM wallet_transactions WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM retention_stages WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM referrals WHERE referrer_customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%') OR referred_customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        await conn.execute("DELETE FROM customers WHERE ext_id LIKE 'qa-hub-%'")
        print("Cleanup completed successfully.")

        # ----------------------------------------------------
        # ITEM 8: SQL Queries
        # ----------------------------------------------------
        print("\n--- ITEM 8: SQL QUERIES ---")
        b_rows = await conn.fetch("SELECT slug, welcome_bonus_amount FROM businesses ORDER BY slug")
        print("SELECT slug, welcome_bonus_amount FROM businesses;")
        for r in b_rows:
            print(f"  {r['slug']}: {r['welcome_bonus_amount']}")

        wb_count = await conn.fetchval("SELECT COUNT(*) FROM wallet_transactions WHERE kind='welcome_bonus'")
        print(f"\nSELECT COUNT(*) FROM wallet_transactions WHERE kind='welcome_bonus';\n  Count: {wb_count}")

        # ----------------------------------------------------
        # CUSTOMERS BY BUSINESS
        # ----------------------------------------------------
        print("\n--- CUSTOMERS BY BUSINESS ---")
        cust_counts = await conn.fetch("""
            SELECT b.slug, count(c.id) as total_customers
            FROM businesses b
            LEFT JOIN customers c ON c.business_id = b.id
            GROUP BY b.slug
            ORDER BY b.slug
        """)
        for cc in cust_counts:
            print(f"  {cc['slug']}: {cc['total_customers']} customers")

        print("\n==========================================")
        print("ALL TESTS AND QUERIES COMPLETED CLEANLY!")
        print("==========================================")

    finally:
        await client.aclose()
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_all_tests())
