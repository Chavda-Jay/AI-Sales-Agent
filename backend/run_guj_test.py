import json
import urllib.request
import sys

payload = json.dumps({
    'customerId': 'lang-guj-native-test-3', 
    'message': '\u0a86 \u0aaa\u0acd\u0ab0\u0acb\u0aa1\u0a95\u0acd\u0a9f\u0aa8\u0ac0 \u0a95\u0abf\u0a82\u0aae\u0aa4 \u0ab6\u0ac1\u0a82 \u0a9b\u0ac7?', 
    'shop': 'sharma-electronics'
}).encode('utf-8')

req = urllib.request.Request('http://127.0.0.1:3001/api/chat', headers={'Content-Type': 'application/json'}, data=payload)
try:
    resp = urllib.request.urlopen(req, timeout=90)
    data = json.loads(resp.read().decode())
    with open('test_output.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
