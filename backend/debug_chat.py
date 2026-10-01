import urllib.request
import json

req = urllib.request.Request(
    'http://127.0.0.1:3001/api/chat',
    data=json.dumps({
        'customerId': 'fix-test-user-4',
        'message': 'ohh bhai bahut mehanga hai ?',
        'shop': 'urban-threads'
    }).encode(),
    headers={'Content-Type': 'application/json'}
)

try:
    resp = urllib.request.urlopen(req)
    out = resp.read().decode('utf-8')
    with open('chat_debug_out.json', 'w', encoding='utf-8') as f:
        f.write(out)
    print("Saved response to chat_debug_out.json")
except urllib.error.HTTPError as e:
    err = e.read().decode('utf-8')
    with open('chat_debug_err.json', 'w', encoding='utf-8') as f:
        f.write(err)
    print("Saved error to chat_debug_err.json")
except Exception as e:
    print('Error:', e)
