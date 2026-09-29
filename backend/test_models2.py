import os
import requests
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GROQ_API_KEY")
messages = [{"role": "user", "content": "hello"}]
for m in ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "allam-2-7b"]:
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        json={"model": m, "messages": messages, "max_tokens": 10},
    )
    print(f"Model {m}: {r.status_code}")
