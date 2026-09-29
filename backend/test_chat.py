import urllib.request
import json

def test_chat(message, customer_id, file):
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
            file.write(f"\n--- TEST: {message} ---\n")
            file.write(f"REPLY: {data.get('reply')}\n")
            file.write(f"UPSELL PRODUCT: {data.get('upsell_product')}\n")
            file.write(f"CROSS SELL: {data.get('cross_sell_product')}\n")
            file.write(f"JSON OUTPUT: {json.dumps(data, indent=2)}\n")
    except Exception as e:
        file.write(f"Error: {e}\n")
        if hasattr(e, 'read'):
            file.write(e.read().decode() + "\n")

with open("chat_test_results.txt", "w", encoding="utf-8") as f:
    test_chat("Cotton T-shirt aur Formal Shirt mein kya fark hai, mujhe office ke liye chahiye", "test-user-1", f)
    test_chat("mera budget 1000 hai, kuch achha sneakers dikhao", "test-user-2", f)
    test_chat("Cotton T-shirt lena hai", "test-user-3", f)
