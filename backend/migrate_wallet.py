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
        # Add wallet_balance column to customers
        await conn.execute("""
            ALTER TABLE customers 
            ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;
        """)
        print("wallet_balance column added to customers table.")
        
    except Exception as e:
        print(f"Error applying migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
