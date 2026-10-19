import asyncio
import os
import json
import urllib.request
import urllib.error
import asyncpg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
API_BASE = "http://127.0.0.1:3001"

async def main():
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        # Pre-cleanup in case of prior aborted run
        await conn.execute("""
            DELETE FROM consent_logs WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%');
            DELETE FROM wallet_transactions WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%');
            DELETE FROM customers WHERE ext_id LIKE 'qa-hub-%';
        """)

        # TEST 1: Bina tick onboard (consent_whatsapp = False)
        ext_unticked = "qa-hub-unticked-01"
        phone_unticked = "9811122233"
        payload_unticked = json.dumps({
            "customerId": ext_unticked,
            "name": "QA Unticked User",
            "phone": phone_unticked,
            "city": "Ahmedabad",
            "delivery_address": "Ahmedabad, Gujarat",
            "consent_whatsapp": False
        }).encode("utf-8")

        req1 = urllib.request.Request(
            f"{API_BASE}/api/store/onboard?shop=sharma-electronics",
            data=payload_unticked,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req1) as resp:
            data1 = json.loads(resp.read().decode())
        
        row1 = await conn.fetchrow(
            "SELECT id, ext_id, consent_whatsapp, opted_out FROM customers WHERE ext_id = $1",
            ext_unticked
        )
        log1 = await conn.fetchrow(
            "SELECT customer_id, channel, consented, opted_out, reason FROM consent_logs WHERE customer_id = $1 ORDER BY id DESC LIMIT 1",
            row1["id"]
        )

        print("=== TEST 1: BINA TICK ONBOARD (DEFAULT UNCHECKED) ===")
        print(f"Customer ext_id        : {row1['ext_id']}")
        print(f"customers.consent_wa   : {row1['consent_whatsapp']}")
        print(f"customers.opted_out    : {row1['opted_out']}")
        print(f"consent_logs.consented : {log1['consented']}")
        print(f"consent_logs.opted_out : {log1['opted_out']}")
        print(f"consent_logs.reason    : {log1['reason']}")
        assert row1["consent_whatsapp"] is False, "Expected customers.consent_whatsapp to be FALSE"
        assert row1["opted_out"] is True, "Expected customers.opted_out to be TRUE"
        assert log1["consented"] is False, "Expected consent_logs.consented to be FALSE"
        assert log1["opted_out"] is True, "Expected consent_logs.opted_out to be TRUE"
        print("RESULT                 : PASS (consent_whatsapp=FALSE, consented=FALSE)\n")

        # TEST 2: Tick ke saath onboard (consent_whatsapp = True)
        ext_ticked = "qa-hub-ticked-02"
        phone_ticked = "9822233344"
        payload_ticked = json.dumps({
            "customerId": ext_ticked,
            "name": "QA Ticked User",
            "phone": phone_ticked,
            "city": "Surat",
            "delivery_address": "Surat, Gujarat",
            "consent_whatsapp": True
        }).encode("utf-8")

        req2 = urllib.request.Request(
            f"{API_BASE}/api/store/onboard?shop=sharma-electronics",
            data=payload_ticked,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req2) as resp:
            data2 = json.loads(resp.read().decode())

        row2 = await conn.fetchrow(
            "SELECT id, ext_id, consent_whatsapp, opted_out FROM customers WHERE ext_id = $1",
            ext_ticked
        )
        log2 = await conn.fetchrow(
            "SELECT customer_id, channel, consented, opted_out, reason FROM consent_logs WHERE customer_id = $1 ORDER BY id DESC LIMIT 1",
            row2["id"]
        )

        print("=== TEST 2: TICK KE SAATH ONBOARD ===")
        print(f"Customer ext_id        : {row2['ext_id']}")
        print(f"customers.consent_wa   : {row2['consent_whatsapp']}")
        print(f"customers.opted_out    : {row2['opted_out']}")
        print(f"consent_logs.consented : {log2['consented']}")
        print(f"consent_logs.opted_out : {log2['opted_out']}")
        print(f"consent_logs.reason    : {log2['reason']}")
        assert row2["consent_whatsapp"] is True, "Expected customers.consent_whatsapp to be TRUE"
        assert row2["opted_out"] is False, "Expected customers.opted_out to be FALSE"
        assert log2["consented"] is True, "Expected consent_logs.consented to be TRUE"
        assert log2["opted_out"] is False, "Expected consent_logs.opted_out to be FALSE"
        print("RESULT                 : PASS (consent_whatsapp=TRUE, consented=TRUE)\n")

        # TEST 3: Skip for now -> FALSE
        ext_skipped = "qa-hub-skipped-03"
        phone_skipped = "9833344455"
        # Create an existing customer first (as if visited previously)
        biz_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = 'sharma-electronics'")
        cust3_id = await conn.fetchval("""
            INSERT INTO customers (ext_id, business_id, shop, name, phone, consent_whatsapp, opted_out)
            VALUES ($1, $2, 'sharma-electronics', 'QA Skipped User', $3, TRUE, FALSE)
            RETURNING id
        """, ext_skipped, biz_id, phone_skipped)

        payload_skip = json.dumps({
            "customerId": ext_skipped,
            "promotional_messages": False
        }).encode("utf-8")

        req3 = urllib.request.Request(
            f"{API_BASE}/api/store/me/consent?shop=sharma-electronics",
            data=payload_skip,
            headers={"Content-Type": "application/json"},
            method="PATCH"
        )
        with urllib.request.urlopen(req3) as resp:
            data3 = json.loads(resp.read().decode())

        row3 = await conn.fetchrow(
            "SELECT id, ext_id, consent_whatsapp, opted_out FROM customers WHERE ext_id = $1",
            ext_skipped
        )
        log3 = await conn.fetchrow(
            "SELECT customer_id, channel, consented, opted_out, reason FROM consent_logs WHERE customer_id = $1 ORDER BY id DESC LIMIT 1",
            row3["id"]
        )

        print("=== TEST 3: SKIP FOR NOW / PREFERENCE TOGGLE ===")
        print(f"Customer ext_id        : {row3['ext_id']}")
        print(f"customers.consent_wa   : {row3['consent_whatsapp']}")
        print(f"customers.opted_out    : {row3['opted_out']}")
        print(f"consent_logs.consented : {log3['consented']}")
        print(f"consent_logs.opted_out : {log3['opted_out']}")
        print(f"consent_logs.reason    : {log3['reason']}")
        assert row3["consent_whatsapp"] is False, "Expected customers.consent_whatsapp to be FALSE"
        assert row3["opted_out"] is True, "Expected customers.opted_out to be TRUE"
        assert log3["consented"] is False, "Expected consent_logs.consented to be FALSE"
        assert log3["opted_out"] is True, "Expected consent_logs.opted_out to be TRUE"
        print("RESULT                 : PASS (consent_whatsapp=FALSE, consented=FALSE)\n")

        # CLEANUP: Cleanup test customers 'qa-hub-'
        print("=== CLEANUP: DELETING TEST CUSTOMERS ('qa-hub-%') ===")
        del_logs = await conn.execute("DELETE FROM consent_logs WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        del_txs = await conn.execute("DELETE FROM wallet_transactions WHERE customer_id IN (SELECT id FROM customers WHERE ext_id LIKE 'qa-hub-%')")
        del_cust = await conn.execute("DELETE FROM customers WHERE ext_id LIKE 'qa-hub-%'")
        remaining = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE ext_id LIKE 'qa-hub-%'")
        print(f"Deleted consent_logs   : {del_logs}")
        print(f"Deleted wallet_txs     : {del_txs}")
        print(f"Deleted customers      : {del_cust}")
        print(f"Remaining 'qa-hub-'    : {remaining}")
        assert remaining == 0, "Expected 0 remaining qa-hub- customers"
        print("CLEANUP VERIFICATION   : SUCCESS (0 residual records)\n")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
