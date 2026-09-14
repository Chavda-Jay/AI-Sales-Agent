"""Delete a business and all its related data by slug."""
import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SLUG_TO_DELETE = "demo-store"

async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        return
    
    conn = await asyncpg.connect(db_url)
    
    # Find the business
    row = await conn.fetchrow("SELECT id, brand_name, slug FROM businesses WHERE slug = $1", SLUG_TO_DELETE)
    if not row:
        print(f"Business with slug '{SLUG_TO_DELETE}' not found!")
        # Show available businesses
        all_biz = await conn.fetch("SELECT id, brand_name, slug FROM businesses")
        print("\nAvailable businesses:")
        for b in all_biz:
            print(f"  - {b['brand_name']} (slug: {b['slug']}, id: {b['id']})")
        await conn.close()
        return
    
    biz_id = row['id']
    print(f"Found business: {row['brand_name']} (slug: {row['slug']}, id: {biz_id})")
    
    # Get customer IDs for this business
    customer_ids = [r['id'] for r in await conn.fetch("SELECT id FROM customers WHERE business_id = $1", biz_id)]
    print(f"  Customers to delete: {len(customer_ids)}")
    
    # Delete related data
    if customer_ids:
        await conn.execute("DELETE FROM orders WHERE customer_id = ANY($1::int[])", customer_ids)
        print("  ✓ Orders deleted")
        await conn.execute("DELETE FROM conversations WHERE customer_id = ANY($1::int[])", customer_ids)
        print("  ✓ Conversations deleted")
        await conn.execute("DELETE FROM handoffs WHERE customer_id = ANY($1::int[])", customer_ids)
        print("  ✓ Handoffs deleted")
    
    await conn.execute("DELETE FROM customers WHERE business_id = $1", biz_id)
    print("  ✓ Customers deleted")
    await conn.execute("DELETE FROM catalog_items WHERE business_id = $1", biz_id)
    print("  ✓ Catalog items deleted")
    await conn.execute("DELETE FROM admin_users WHERE business_id = $1", biz_id)
    print("  ✓ Admin users deleted")
    await conn.execute("DELETE FROM businesses WHERE id = $1", biz_id)
    print("  ✓ Business deleted")
    
    print(f"\n✅ '{row['brand_name']}' successfully deleted!")
    
    # Show remaining businesses
    remaining = await conn.fetch("SELECT brand_name, slug FROM businesses")
    print(f"\nRemaining businesses ({len(remaining)}):")
    for b in remaining:
        print(f"  - {b['brand_name']} (slug: {b['slug']})")
    
    await conn.close()

asyncio.run(main())
