import os
import uuid
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def run():
    try:
        contents = b"fake image content"
        unique_filename = f"{uuid.uuid4()}.png"
        
        # Test upload
        supabase_client.storage.from_("product-images").upload(
            unique_filename,
            contents,
            {"content-type": "image/png"}
        )
        print("Upload successful!")
        
        public_url = supabase_client.storage.from_("product-images").get_public_url(unique_filename)
        print("Public URL:", public_url)
    except Exception as e:
        print("Error during file upload:", repr(e))

run()
