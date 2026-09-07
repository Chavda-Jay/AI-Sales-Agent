import os
import json
import asyncio
import asyncpg
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path, override=True)

async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL is not set. Cannot run migration.")
        return

    print("Connecting to database...")
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    
    businesses_to_migrate = [
        {"file": "business-config-electronics.json", "slug": "sharma-electronics"},
        {"file": "business-config-clothing.json", "slug": "urban-threads"}
    ]

    try:
        for b in businesses_to_migrate:
            filepath = os.path.join(BASE_DIR, b["file"])
            if not os.path.exists(filepath):
                print(f"File not found: {filepath}")
                continue
                
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            brand_name = data.get("brandName", "Unknown Brand")
            language = data.get("language", "English + Hindi mix (Hinglish)")
            policies = data.get("policies", "")
            catalog = data.get("catalog", [])
            
            # Insert or ignore business
            business_id = await conn.fetchval("""
                INSERT INTO businesses (slug, brand_name, language, policies)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (slug) DO UPDATE SET 
                    brand_name = EXCLUDED.brand_name,
                    language = EXCLUDED.language,
                    policies = EXCLUDED.policies
                RETURNING id
            """, b["slug"], brand_name, language, policies)
            
            print(f"Upserted business '{brand_name}' with slug '{b['slug']}' (ID: {business_id})")
            
            # Delete existing catalog items for this business to avoid duplicates if re-run
            await conn.execute("DELETE FROM catalog_items WHERE business_id = $1", business_id)
            
            items_inserted = 0
            for item in catalog:
                await conn.execute("""
                    INSERT INTO catalog_items (business_id, name, price, note, image_url)
                    VALUES ($1, $2, $3, $4, $5)
                """, business_id, item.get("name"), float(item.get("price", 0)), item.get("note", ""), item.get("image_url", None))
                items_inserted += 1
                
            print(f"Inserted {items_inserted} catalog items for '{brand_name}'.")

        # Backfill existing customers based on shop
        print("Backfilling existing records...")
        await conn.execute("""
            UPDATE customers SET business_id = b.id
            FROM businesses b
            WHERE customers.shop = b.slug OR 
                  (customers.shop = 'electronics' AND b.slug = 'sharma-electronics') OR
                  (customers.shop = 'clothing' AND b.slug = 'urban-threads')
        """)
        print("Backfilled customers.")
        
        # Now backfill conversations, orders, handoffs based on customer.business_id
        await conn.execute("""
            UPDATE conversations SET business_id = c.business_id
            FROM customers c WHERE conversations.customer_id = c.id
        """)
        await conn.execute("""
            UPDATE orders SET business_id = c.business_id
            FROM customers c WHERE orders.customer_id = c.id
        """)
        await conn.execute("""
            UPDATE handoffs SET business_id = c.business_id
            FROM customers c WHERE handoffs.customer_id = c.id
        """)
        print("Backfilled related tables.")
        
        print("\nMigration completed successfully!")
            
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
