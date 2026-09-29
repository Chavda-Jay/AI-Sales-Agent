import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GROQ_API_KEY")
messages = [{"role": "user", "content": "hello"}]
r = requests.post(
    "https://api.groq.com/openai/v1/chat/completions",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    json={"model": "openai/gpt-oss-120b", "messages": messages, "max_tokens": 10},
)
print("Status Code:", r.status_code)
print("Response:", r.text)
