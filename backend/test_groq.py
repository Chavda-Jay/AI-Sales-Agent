import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

prompt = """
You are a helpful AI sales agent. 
- HUMAN HANDOFF: Set `needs_human` to true + `handoff_reason` if: customer is angry, asks for human/manager, mentions legal/fraud/payment disputes, customer mentions a serious personal situation (health emergency, bereavement, major life event) or expresses they may escalate publicly (social media complaint threat), or asks something completely outside your knowledge.
Respond only in JSON with fields: `needs_human` (bool) and `handoff_reason` (string).
"""

message = "mere family mein kisi ki death ho gayi, order cancel karna hai"

def run():
    res = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": message}
            ],
            "response_format": {"type": "json_object"}
        },
        timeout=15.0
    )
    print("GROQ TEST 5 JSON:", res.json()["choices"][0]["message"]["content"])

run()
