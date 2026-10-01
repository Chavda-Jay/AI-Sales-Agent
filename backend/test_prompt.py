import asyncio
import asyncpg
sys = __import__('sys')
sys.path.append(r'c:\Users\Saubhagyam\ai-sales-agent\backend')
from main import get_upcoming_festivals

async def main():
    conn = await asyncpg.connect('postgresql://postgres.qwfvpnjmunxxxnhhqrgn:%5EppCD2%23Y4arxTpn@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', statement_cache_size=0)
    business_id = 2
    brand_name = 'Urban Threads'
    lang = 'Hinglish'
    product_target = 'All Products'
    content_target = 'Mix'
    best_sellers_rows = await conn.fetch('''
        SELECT ci.name, COUNT(*) as cnt FROM orders o 
        JOIN catalog_items ci ON ci.id = o.product_id
        WHERE o.status = 'confirmed' AND ci.business_id = $1 
        GROUP BY ci.name ORDER BY cnt DESC LIMIT 3
    ''', business_id)
    best_sellers = ", ".join([r['name'] for r in best_sellers_rows]) if best_sellers_rows else "no data yet"
    reviews_rows = await conn.fetch('''
        SELECT review_text FROM reviews 
        WHERE business_id = $1 ORDER BY created_at DESC LIMIT 3
    ''', business_id)
    reviews = " | ".join([r['review_text'] for r in reviews_rows]) if reviews_rows else "no reviews yet"
    objections_rows = await conn.fetch('''
        SELECT DISTINCT objection FROM handoffs h 
        JOIN customers c ON c.id = h.customer_id
        WHERE c.business_id = $1 AND objection IS NOT NULL 
        ORDER BY objection DESC LIMIT 3
    ''', business_id)
    objections = " | ".join([r['objection'] for r in objections_rows]) if objections_rows else "none recorded"
    festival_context = get_upcoming_festivals()
    if not festival_context or festival_context.strip() == "":
        festival_context = "no major festival in next 14 days"
    system_prompt = f"""
You are a social media content strategist for an Indian B2C brand called {brand_name}.
Generate 4 short, ready-to-use content ideas for {product_target} targeting Indian consumers.
Format required: {content_target}.

Real context to inspire ideas (use ONLY what's genuinely relevant, don't force all of it):
- Best-selling products: {best_sellers}
- Recent customer reviews: {reviews}
- Common customer objections/hesitations: {objections}
- Upcoming festivals/events: {festival_context}
Base your 4 ideas on this REAL data where relevant, not generic assumptions.

For each idea include:
- format: the content format (e.g. Instagram Reel, Post, Story, Offer)
- caption: a short catchy caption/hook (in {lang})
- why_it_works: one line on why it would work (can be in English or {lang}). Tie to upcoming Indian festivals/seasons or customer feedback if relevant.

Return ONLY a valid JSON array of objects with fields: format, caption, why_it_works. Do not include markdown blocks like ```json.
"""
    print(system_prompt)
    await conn.close()
asyncio.run(main())
