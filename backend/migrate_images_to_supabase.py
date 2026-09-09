import asyncio
import asyncpg
import os
import mimetypes
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate_images():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing Supabase credentials in .env")
        return
        
    print("Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Check if bucket exists, if not create it
    bucket_name = "product-images"
    try:
        buckets = supabase.storage.list_buckets()
        bucket_exists = any(b.name == bucket_name for b in buckets)
        if not bucket_exists:
            print(f"Creating bucket '{bucket_name}'...")
            supabase.storage.create_bucket(bucket_name, options={"public": True})
            print("Bucket created successfully!")
        else:
            print(f"Bucket '{bucket_name}' already exists.")
    except Exception as e:
        print(f"Error checking/creating bucket. Ensure your SUPABASE_KEY is a service role key. Error: {e}")
        return

    print("Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL)
    
    # Fetch all catalog items that have local image URLs
    items = await conn.fetch("SELECT id, image_url FROM catalog_items WHERE image_url LIKE '/images/%'")
    print(f"Found {len(items)} catalog items with local images.")
    
    frontend_public_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public")
    
    for item in items:
        item_id = item['id']
        local_url = item['image_url'] # e.g. /images/samsung_tv.jpg
        
        # Remove leading slash to make path relative to public dir
        relative_path = local_url.lstrip('/')
        file_path = os.path.join(frontend_public_dir, relative_path.replace('/', os.sep))
        
        if os.path.exists(file_path):
            filename = os.path.basename(file_path)
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = "application/octet-stream"
                
            try:
                # Upload to supabase
                print(f"Uploading {filename} to Supabase...")
                with open(file_path, 'rb') as f:
                    # Overwrite if exists
                    supabase.storage.from_(bucket_name).upload(
                        filename, 
                        f.read(), 
                        {"content-type": content_type, "upsert": "true"}
                    )
                
                # Get public URL
                public_url = supabase.storage.from_(bucket_name).get_public_url(filename)
                
                # Update database
                await conn.execute("UPDATE catalog_items SET image_url = $1 WHERE id = $2", public_url, item_id)
                print(f"[OK] Updated item {item_id} with Supabase URL.")
                
            except Exception as e:
                print(f"[FAIL] Error uploading {filename}: {e}")
        else:
            print(f"[WARN] File not found locally: {file_path}")
            
    await conn.close()
    print("Migration finished!")

if __name__ == "__main__":
    asyncio.run(migrate_images())
