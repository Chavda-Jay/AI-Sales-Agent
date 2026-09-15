import os
import asyncio
import asyncpg
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path, override=True)

async def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set.")
        return
        
    conn = await asyncpg.connect(db_url)
    
    try:
        # Add columns to customers
        await conn.execute("""
            ALTER TABLE customers 
            ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
            ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
        """)
        print("Columns added to customers table.")
        
        # Create referrals table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS referrals (
                id SERIAL PRIMARY KEY,
                referrer_customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
                referred_customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
                referral_code TEXT NOT NULL,
                referred_order_id INT REFERENCES orders(id) ON DELETE SET NULL,
                reward_status TEXT DEFAULT 'pending', -- pending / earned
                reward_amount NUMERIC DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        print("referrals table created.")
        
    except Exception as e:
        print(f"Error applying migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
