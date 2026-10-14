import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        # Check /api/analytics
        res1 = await client.get("http://127.0.0.1:3001/api/analytics?shop=sharma-electronics", timeout=10)
        print("Analytics Keys:", list(res1.json().keys()) if res1.ok else res1.text)
        
        # Check /api/daily-report
        res2 = await client.get("http://127.0.0.1:3001/api/daily-report?shop=sharma-electronics", timeout=10)
        print("Daily Report Keys:", list(res2.json().keys()) if res2.ok else res2.text)

if __name__ == "__main__":
    asyncio.run(main())
