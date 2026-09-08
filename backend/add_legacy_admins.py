import asyncio
import asyncpg
import os
from dotenv import load_dotenv
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    load_dotenv(override=True)
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"), statement_cache_size=0)
    
    stores = [
        {"slug": "urban-threads", "email": "urban@threads.com", "password": "Urban123"},
        {"slug": "sharma-electronics", "email": "sharma@electronics.com", "password": "Sharma123"}
    ]
    
    for s in stores:
        bid = await conn.fetchval("SELECT id FROM businesses WHERE slug=$1", s["slug"])
        if bid:
            await conn.execute("""
                INSERT INTO admin_users(business_id, email, password_hash) 
                VALUES($1, $2, $3) 
                ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash
            """, bid, s["email"], pwd_context.hash(s["password"]))
            print(f"Added {s['slug']} -> {s['email']} / {s['password']}")
        else:
            print(f"Store {s['slug']} not found in DB.")
            
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
