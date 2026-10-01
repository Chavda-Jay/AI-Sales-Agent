import json
import urllib.request
import sys

tests = [
    {"name": "English", "message": "Can you recommend a good smart TV under 30000?"},
    {"name": "Hindi", "message": "क्या आप मुझे 30000 के अंदर कोई अच्छा स्मार्ट टीवी बता सकते हैं?"},
    {"name": "Hinglish", "message": "mujhe 30000 ke under koi achha smart tv dikhao"}
]

output_data = []

for t in tests:
    payload = json.dumps({
        'customerId': f'lang-core-test-{t["name"]}', 
        'message': t["message"], 
        'shop': 'sharma-electronics'
    }).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:3001/api/chat', headers={'Content-Type': 'application/json'}, data=payload)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read().decode())
        output_data.append({
            "language": t["name"],
            "detected": data.get('detected_language'),
            "reply": data.get('reply')
        })
    except Exception as e:
        pass

with open('core_langs_output.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)
