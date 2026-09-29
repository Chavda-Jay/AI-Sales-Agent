import urllib.request
import json

def test_chat(message, customer_id, label, file):
    # Clear in-memory history by using a unique customer_id each time
    req = urllib.request.Request(
        "http://127.0.0.1:3001/api/chat",
        headers={"Content-Type": "application/json"},
        data=json.dumps({
            "customerId": customer_id,
            "message": message,
            "shop": "sharma-electronics"
        }).encode('utf-8')
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            file.write(f"\n{'='*60}\n")
            file.write(f"TEST: {label}\n")
            file.write(f"Customer ID: {customer_id}\n")
            file.write(f"Message: {message}\n")
            file.write(f"{'='*60}\n")
            file.write(f"\nAI REPLY:\n{data.get('reply')}\n")
            file.write(f"\nKEY FIELDS:\n")
            file.write(f"  recommended_product: {data.get('recommended_product')}\n")
            file.write(f"  customer_name: {data.get('customer_name')}\n")
            file.write(f"  segment: {data.get('segment')}\n")
            file.write(f"\nRAW LLM OUTPUT:\n{data.get('raw_llm_output')}\n")
            file.write(f"\nFULL JSON:\n{json.dumps(data, indent=2, ensure_ascii=False)}\n")
    except Exception as e:
        file.write(f"Error: {e}\n")
        if hasattr(e, 'read'):
            file.write(e.read().decode() + "\n")

with open("personalization_test_results.txt", "w", encoding="utf-8") as f:
    # TEST 1 & 2 COMMENTED OUT TO FOCUS ON TEST 3
    # TEST 3: Known customer specifically asking about past orders
    test_chat(
        "kya mere pehle order ke hisaab se kuch suggest kar sakte ho?",
        "demo-customer-1789462200889",  # Rudra, Viramgam, LTV 52297, last: Samsung TV
        "PAST ORDER INQUIRY - Should use context naturally",
        f
    )

print("Done! Check personalization_test_results.txt")
