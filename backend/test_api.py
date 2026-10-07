import urllib.request
import json
req = urllib.request.Request('http://127.0.0.1:3001/api/chat', method='POST', headers={'Content-Type': 'application/json'})
data = json.dumps({'customerId': 'CUST-BUGCHECK2', 'message': 'I want a silk saree', 'shop': 'urban-threads'}).encode()
res = urllib.request.urlopen(req, data=data).read().decode('utf-8')
data = json.loads(res)
print(f"Score: {data.get('intent_score')} Segment: {data.get('segment')}")
