import json
import urllib.request

payload = json.dumps({
    'customerId': 'festival-test-user-3', 
    'message': 'Hi, just browsing today.', 
    'shop': 'sharma-electronics'
}).encode('utf-8')

req = urllib.request.Request('http://127.0.0.1:3001/api/chat', headers={'Content-Type': 'application/json'}, data=payload)

print("Sending message to AI...")
try:
    resp = urllib.request.urlopen(req, timeout=30)
    data = json.loads(resp.read().decode())
    print("\n--- AI REPLY ---")
    print(data.get('reply').encode('utf-8').decode('cp1252', 'ignore'))
    print("----------------\n")
except Exception as e:
    print(f"Error: {e}")
