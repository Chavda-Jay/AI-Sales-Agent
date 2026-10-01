import asyncio
import sys
sys.stdout.reconfigure(encoding='utf-8')
import httpx
import json

import os
API_KEY = os.getenv("GROQ_API_KEY", "your-api-key")

async def main():
    test_models = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "allam-2-7b",
    ]
    
    async with httpx.AsyncClient() as client:
        for model in test_models:
            print(f"\n--- Testing: {model} ---")
            for attempt in range(3):
                try:
                    resp = await client.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        headers={
                            'Authorization': f'Bearer {API_KEY}',
                            'Content-Type': 'application/json'
                        },
                        json={
                            'model': model,
                            'messages': [{'role': 'user', 'content': 'Say hello in 5 words'}],
                            'max_tokens': 30,
                            'temperature': 0.1
                        },
                        timeout=30.0
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        reply = data['choices'][0]['message']['content']
                        print(f"  ✅ Attempt {attempt+1}: SUCCESS -> {reply.strip()}")
                        break
                    elif resp.status_code == 429:
                        retry_after = resp.headers.get('retry-after', '?')
                        print(f"  ⚠️ Attempt {attempt+1}: RATE LIMITED (429), retry-after: {retry_after}s")
                        await asyncio.sleep(5)
                    else:
                        err = resp.text[:200]
                        print(f"  ❌ Attempt {attempt+1}: HTTP {resp.status_code} -> {err}")
                        break
                except Exception as e:
                    print(f"  ❌ Attempt {attempt+1}: Error: {e}")
                    await asyncio.sleep(2)

asyncio.run(main())
