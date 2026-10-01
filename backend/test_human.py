import urllib.request
import json
import io

req = urllib.request.Request(
    'http://127.0.0.1:3001/api/chat',
    data=json.dumps({
        'customerId': 'audit-test-1',
        'message': 'kya aap ek real insaan ho ya AI?',
        'shop': 'urban-threads'
    }).encode(),
    headers={'Content-Type': 'application/json'}
)

try:
    resp = urllib.request.urlopen(req)
    reply = json.loads(resp.read().decode('utf-8'))['reply']
    with io.open('reply1.txt', 'w', encoding='utf-8') as f:
        f.write(reply)
except Exception as e:
    print('Error:', e)
