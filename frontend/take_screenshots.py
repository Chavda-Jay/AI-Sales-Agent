import asyncio
from playwright.async_api import async_playwright
import os

ARTIFACT_DIR = r"C:\Users\Saubhagyam\.gemini\antigravity-ide\brain\86e3f2c1-42c7-45c5-a917-5c305f88be63"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Navigating to login...")
        await page.goto("http://localhost:3000/dashboard/login")
        await page.wait_for_timeout(2000)

        # Login
        await page.fill('input[type="email"]', 'test@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button[type="submit"]')
        
        print("Waiting for dashboard to load...")
        await page.wait_for_timeout(4000)

        print("Taking Needs Attention / Handoff screenshot...")
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "handoff_details.png"))

        print("Clicking a store to open sidebar options...")
        try:
            await page.locator("text=Urban Threads").first.click()
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Could not click store: {e}")

        print("Navigating to Orders...")
        try:
            await page.locator("text=Orders").first.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path=os.path.join(ARTIFACT_DIR, "orders_page.png"))
        except:
            pass

        print("Navigating to Content Ideas...")
        try:
            await page.locator("text=Content Ideas").first.click()
            await page.wait_for_timeout(1000)
            try:
                await page.locator("text=Generate Ideas").first.click()
                await page.wait_for_timeout(5000)
            except:
                print("No Generate button found, just taking screenshot")
            await page.screenshot(path=os.path.join(ARTIFACT_DIR, "content_ideas.png"))
        except:
            pass

        print("Navigating to Daily Report...")
        try:
            await page.locator("text=Daily Report").first.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=os.path.join(ARTIFACT_DIR, "daily_report.png"))
        except:
            pass

        print("Testing Mobile Views...")
        await page.set_viewport_size({'width': 375, 'height': 667})
        
        await page.goto("http://localhost:3000/dashboard")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "mobile_dashboard.png"))
        
        await page.goto("http://localhost:3000/store?shop=urban-threads")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "mobile_store.png"))

        await browser.close()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
