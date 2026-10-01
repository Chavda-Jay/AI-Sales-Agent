import json
import urllib.request
import sys
sys.stdout.reconfigure(encoding='utf-8')

tests = [
    ('trust-user', 'yeh genuine company hai na? kahin fraud to nahi?'),
    ('delivery-user', 'delivery kab tak hogi?')
]

for uid, msg in tests:
    req = urllib.request.Request(
        'http://127.0.0.1:3001/api/chat',
        data=json.dumps({'customerId': uid, 'message': msg, 'shop': 'sharma-electronics'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode('utf-8'))
        print(f"\n--- TEST: {msg} ---")
        print(f"REPLY: {data.get('reply')}")
        print(f"NEXT_ACTION: {data.get('next_action')}")
    except Exception as e:
        print(f"Error testing {msg}: {e}")
