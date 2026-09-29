import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GROQ_API_KEY")
print("KEY loaded:", bool(key))
if key:
    r = requests.get('https://api.groq.com/openai/v1/models', headers={'Authorization': f'Bearer {key}'})
    data = r.json()
    print("Models:", [m.get('id') for m in data.get('data', [])])
