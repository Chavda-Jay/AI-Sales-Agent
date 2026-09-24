import os
import asyncio
import json
import re
import logging
import uuid
import shutil
from fastapi import FastAPI, HTTPException, Request, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv
import httpx
import asyncpg  # type: ignore
from contextlib import asynccontextmanager
import asyncio
# pyrefly: ignore [missing-import]
import jwt
from datetime import datetime, timedelta, timezone
# pyrefly: ignore [missing-import]
from passlib.context import CryptContext
# pyrefly: ignore [missing-import]s
from supabase import create_client, Client

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path, override=True)

db_pool = None
password_reset_otps = {} # Dict to store email -> OTP for demo purposes
supabase_client = None
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODELS = [
    GROQ_MODEL, 
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b", 
    "allam-2-7b"
]

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-default-key-for-demo")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

TIER_MAPPING = {
    "Tier-1": [
        "mumbai", "delhi", "new delhi", "bangalore", "bengaluru", "chennai", 
        "kolkata", "hyderabad", "pune", "ahmedabad"
    ],
    "Tier-2": [
        "agra", "ajmer", "aligarh", "amravati", "amritsar", "asansol", "aurangabad", 
        "bareilly", "belagavi", "bhavnagar", "bhiwandi", "bhopal", "bhubaneswar", 
        "bikaner", "bilaspur", "bokaro", "chandigarh", "coimbatore", "cuttack", 
        "dehradun", "dhanbad", "bhilai", "durgapur", "erode", "faridabad", 
        "firozabad", "ghaziabad", "gorakhpur", "gulbarga", "guntur", "gwalior", 
        "gurugram", "gurgaon", "guwahati", "hubli", "dharwad", "indore", "jabalpur", 
        "jaipur", "jalandhar", "jammu", "jamnagar", "jamshedpur", "jhansi", 
        "jodhpur", "kakinada", "kannur", "kanpur", "karnal", "kochi", "kolhapur", 
        "kollam", "kozhikode", "kurnool", "ludhiana", "lucknow", "madurai", 
        "malappuram", "mathura", "mangaluru", "mangalore", "meerut", "moradabad", 
        "mysore", "mysuru", "nagpur", "nanded", "nashik", "nellore", "noida", 
        "greater noida", "patna", "puducherry", "purulia", "prayagraj", "allahabad", 
        "raipur", "rajkot", "rajamahendravaram", "rajahmundry", "ranchi", "rourkela", 
        "salem", "sangli", "shimla", "siliguri", "solapur", "srinagar", "surat", 
        "thiruvananthapuram", "trivandrum", "thrissur", "tiruchirappalli", "trichy", 
        "tirunelveli", "ujjain", "vadodara", "varanasi", "banaras", "vasai", "virar", 
        "vijayawada", "visakhapatnam", "vizag", "warangal"
    ]
}

def get_city_tier(city_name: str) -> str:
    if not city_name:
        return "Tier-3/Other"
    city_lower = city_name.strip().lower()
    for tier, cities in TIER_MAPPING.items():
        if city_lower in cities:
            return tier
    return "Tier-3/Other"

security = HTTPBearer()

def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


FOLLOW_UP_MAX_STAGE = {'HOT': 4, 'WARM': 3, 'COLD': 3}  # §17: HOT has 4 touches, WARM/COLD have 3

async def follow_up_cadence_worker():
    # §17 follow-up engine: nurtures HOT/WARM/COLD leads on a segment-specific cadence,
    # independent of cart abandonment. Replaces the old single-touch abandoned_chat_worker.
    while True:
        await asyncio.sleep(900)  # 15 minutes — fine-grained enough to catch HOT's ~3-min first touch
        if not db_pool or not GROQ_API_KEY:
            continue
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT c.id, c.ext_id, c.segment, c.follow_up_stage, b.slug as shop_slug, c.business_id
                    FROM customers c
                    JOIN businesses b ON c.business_id = b.id
                    WHERE c.segment IN ('HOT', 'WARM', 'COLD')
                      AND c.opted_out = FALSE
                      AND (c.followed_up_at IS NULL OR c.followed_up_at < c.last_interaction)
                      AND c.follow_up_stage < (CASE c.segment WHEN 'HOT' THEN 4 ELSE 3 END)
                      AND c.last_interaction <= NOW() - (
                          CASE
                            WHEN c.segment = 'HOT'  AND c.follow_up_stage = 0 THEN INTERVAL '3 minutes'
                            WHEN c.segment = 'HOT'  AND c.follow_up_stage = 1 THEN INTERVAL '4 hours'
                            WHEN c.segment = 'HOT'  AND c.follow_up_stage = 2 THEN INTERVAL '24 hours'
                            WHEN c.segment = 'HOT'  AND c.follow_up_stage = 3 THEN INTERVAL '48 hours'
                            WHEN c.segment = 'WARM' AND c.follow_up_stage = 0 THEN INTERVAL '1 day'
                            WHEN c.segment = 'WARM' AND c.follow_up_stage = 1 THEN INTERVAL '3 days'
                            WHEN c.segment = 'WARM' AND c.follow_up_stage = 2 THEN INTERVAL '7 days'
                            WHEN c.segment = 'COLD' AND c.follow_up_stage = 0 THEN INTERVAL '7 days'
                            WHEN c.segment = 'COLD' AND c.follow_up_stage = 1 THEN INTERVAL '14 days'
                            WHEN c.segment = 'COLD' AND c.follow_up_stage = 2 THEN INTERVAL '30 days'
                          END
                      )
                """)

                for row in rows:
                    segment = row['segment']
                    stage = row['follow_up_stage'] or 0
                    customer_id = row['id']
                    ext_id = row['ext_id']
                    business_id = row['business_id']

                    try:
                        config = await load_config_from_db(row['shop_slug'], conn)
                    except Exception:
                        continue

                    stage_instruction = {
                        0: "This is a helpful, no-pressure check-in — gently ask if they need help deciding.",
                        1: "Gently address a likely hesitation (price, trust, delivery) without being asked, and reassure them.",
                        2: "You can mention a relevant existing incentive (e.g. the FIRST10 coupon) once if genuinely relevant. Do not invent any discount not in the catalog/policies.",
                        3: "This is the final follow-up in this sequence. Keep it brief and low-pressure.",
                    }.get(stage, "Gently re-engage the customer.")

                    system_prompt = f"""You are the AI sales agent for {config.get('brandName')}.
Language: {config.get('language')}
Store policies: {config.get('policies')}
The customer (segment: {segment}) showed interest but has gone quiet.
{stage_instruction}
Write a very short, natural follow-up message.
Return ONLY raw JSON: {{"reply": "your message"}}
"""
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": "Generate the next follow-up message in the sequence."}
                    ]

                    reply = None
                    async with httpx.AsyncClient() as client:
                        for current_model in FALLBACK_MODELS:
                            try:
                                groq_response = await client.post(
                                    "https://api.groq.com/openai/v1/chat/completions",
                                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
                                    json={"model": current_model, "messages": messages, "max_tokens": 120, "temperature": 0.7},
                                    timeout=10.0
                                )
                                data = groq_response.json()
                                if "error" in data:
                                    continue
                                raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                                raw = re.sub(r'^```json', '', raw)
                                raw = re.sub(r'^```', '', raw)
                                raw = re.sub(r'```$', '', raw).strip()
                                parsed = json.loads(raw)
                                reply = parsed.get("reply")
                                break
                            except Exception:
                                continue

                    if not reply:
                        continue

                    await conn.execute(
                        "INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)",
                        customer_id, business_id, None, reply, 0, segment
                    )
                    await conn.execute(
                        "UPDATE customers SET followed_up_at = NOW(), follow_up_stage = $1 WHERE id = $2",
                        stage + 1, customer_id
                    )
                    if ext_id not in conversations:
                        conversations[ext_id] = []
                    conversations[ext_id].append({"role": "assistant", "content": json.dumps({"reply": reply, "follow_up_stage": stage + 1})})
                    print(f"Sent follow-up (stage {stage+1}/{FOLLOW_UP_MAX_STAGE[segment]}) to {ext_id} [{segment}]")

        except Exception as e:
            print(f"Follow-up cadence worker error: {e}")

async def post_purchase_retention_worker():
    while True:
        await asyncio.sleep(20)  # Frequent checks for demo
        if not db_pool or not GROQ_API_KEY:
            continue
            
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT rs.id, rs.current_stage, rs.stage_updated_at, c.ext_id, c.business_id, rs.customer_id, o.product_id, ci.name as product_name
                    FROM retention_stages rs
                    JOIN customers c ON c.id = rs.customer_id
                    JOIN orders o ON o.id = rs.order_id
                    LEFT JOIN catalog_items ci ON ci.id = o.product_id
                    WHERE (rs.current_stage IN ('confirmed', 'delivered', 'satisfaction_check') AND rs.stage_updated_at < NOW() - INTERVAL '60 seconds')
                       OR (rs.current_stage = 'review_requested' AND rs.stage_updated_at < NOW() - INTERVAL '90 seconds')
                """)
                for row in rows:
                    rs_id = row['id']
                    current_stage = row['current_stage']
                    customer_id = row['customer_id']
                    business_id = row['business_id']
                    ext_id = row['ext_id']
                    product_name = row['product_name'] or "your recent purchase"
                    
                    next_stage = None
                    instruction = ""
                    
                    if current_stage == 'confirmed':
                        next_stage = 'delivered'
                        instruction = "Write a short, polite message telling them their order has been shipped and will arrive soon (add a 📦 emoji)."
                    elif current_stage == 'delivered':
                        next_stage = 'satisfaction_check'
                        instruction = f"The customer received their order of {product_name}. Write a short, polite message asking if they are loving it and how everything is going."
                    elif current_stage == 'satisfaction_check':
                        next_stage = 'review_requested'
                        instruction = "Write a short, polite message asking the customer to leave a quick review."
                    elif current_stage == 'review_requested':
                        next_stage = 'repeat_reminder'
                        # Get random catalog item for cross-sell
                        suggested_item = await conn.fetchval("SELECT name FROM catalog_items WHERE business_id = $1 AND id != $2 ORDER BY RANDOM() LIMIT 1", business_id, row['product_id'] or 0)
                        suggested_item = suggested_item or "our newest arrivals"
                        instruction = f"Write a short, polite message saying it's been a while, and suggest they check out a new item we think they'll love: {suggested_item}."
                        
                    if next_stage:
                        try:
                            # Prompt Groq
                            sys_prompt = "You are the AI Sales Agent for this business. Generate a short polite post-purchase follow-up message in the same language as the customer's last messages. Output ONLY a JSON object: {\"reply\": \"your message\"}. " + instruction
                            
                            hist_rows = await conn.fetch("SELECT message, reply FROM conversations WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 3", customer_id)
                            messages = [{"role": "system", "content": sys_prompt}]
                            for hr in reversed(hist_rows):
                                if hr['message']: messages.append({"role": "user", "content": hr['message']})
                                if hr['reply']: messages.append({"role": "assistant", "content": hr['reply']})
                                
                            async with httpx.AsyncClient() as client:
                                data = None
                                for current_model in FALLBACK_MODELS:
                                    try:
                                        groq_response = await client.post(
                                            "https://api.groq.com/openai/v1/chat/completions",
                                            headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
                                            json={"model": current_model, "messages": messages, "max_tokens": 150, "temperature": 0.7},
                                            timeout=10.0
                                        )
                                        data = groq_response.json()
                                        if "error" in data:
                                            continue
                                        break
                                    except:
                                        continue
                                
                                if not data or "error" in data:
                                    print(f"API Error for retention worker:", data.get("error") if data else "Connection error")
                                    continue
                                raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                                raw = re.sub(r'^```json', '', raw)
                                raw = re.sub(r'^```', '', raw)
                                raw = re.sub(r'```$', '', raw).strip()
                                try:
                                    parsed = json.loads(raw)
                                    reply = parsed.get("reply")
                                except:
                                    reply = None
                                
                                if reply:
                                    # Insert to DB
                                    await conn.execute("INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)", customer_id, business_id, None, reply, 0, 'HOT')
                                    # Update stage
                                    await conn.execute("UPDATE retention_stages SET current_stage = $1, stage_updated_at = NOW() WHERE id = $2", next_stage, rs_id)
                                    # Update in-memory for live polling
                                    if ext_id not in conversations:
                                        conversations[ext_id] = []
                                    conversations[ext_id].append({"role": "assistant", "content": json.dumps({"reply": reply, "retention": True})})
                        except Exception as e:
                            print(f"Error generating retention message: {e}")
        except Exception as e:
            print(f"Retention worker error: {e}")

async def dormant_customer_worker():
    # Dormancy is a slow-moving state (days), so this checks infrequently.
    while True:
        await asyncio.sleep(21600)  # 6 hours
        if not db_pool or not GROQ_API_KEY:
            continue
        try:
            async with db_pool.acquire() as conn:
                # Flip eligible customers to DORMANT and capture ONLY the rows that just transitioned —
                # this is what guarantees exactly one re-engagement message per dormancy event (§25 anti-spam).
                rows = await conn.fetch("""
                    UPDATE customers c
                    SET segment = 'DORMANT'
                    FROM businesses b
                    WHERE c.business_id = b.id
                      AND c.segment IN ('CUSTOMER', 'REPEAT CUSTOMER')
                      AND c.opted_out = FALSE
                      AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
                      AND (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id)
                          < NOW() - make_interval(days => COALESCE(b.dormant_after_days, 30))
                    RETURNING c.id, c.ext_id, c.name, c.business_id, b.slug AS shop_slug
                """)

                for row in rows:
                    customer_id = row['id']
                    ext_id = row['ext_id']
                    business_id = row['business_id']
                    shop_slug = row['shop_slug']

                    try:
                        config = await load_config_from_db(shop_slug, conn)
                    except Exception:
                        continue

                    last_product = await conn.fetchval("""
                        SELECT ci.name FROM orders o
                        LEFT JOIN catalog_items ci ON ci.id = o.product_id
                        WHERE o.customer_id = $1
                        ORDER BY o.created_at DESC LIMIT 1
                    """, customer_id)

                    suggested_item = await conn.fetchval(
                        "SELECT name FROM catalog_items WHERE business_id = $1 ORDER BY RANDOM() LIMIT 1",
                        business_id
                    )

                    system_prompt = f"""You are the AI Shopping Assistant for {config.get('brandName')}.
Language: {config.get('language')}
This customer previously bought {last_product or 'from us'} but hasn't ordered again in a while.
Write a short, warm win-back message. No pressure, no invented discounts.
If it fits naturally, mention: {suggested_item or 'our latest arrivals'}.
Return ONLY raw JSON: {{"reply": "your message"}}
"""
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": "Generate a short dormant-customer re-engagement message."}
                    ]

                    reply = None
                    async with httpx.AsyncClient() as client:
                        for current_model in FALLBACK_MODELS:
                            try:
                                groq_response = await client.post(
                                    "https://api.groq.com/openai/v1/chat/completions",
                                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
                                    json={"model": current_model, "messages": messages, "max_tokens": 150, "temperature": 0.7},
                                    timeout=10.0
                                )
                                data = groq_response.json()
                                if "error" in data:
                                    continue
                                raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                                raw = re.sub(r'^```json', '', raw)
                                raw = re.sub(r'^```', '', raw)
                                raw = re.sub(r'```$', '', raw).strip()
                                parsed = json.loads(raw)
                                reply = parsed.get("reply")
                                break
                            except Exception:
                                continue

                    if not reply:
                        print(f"Dormant worker: no reply generated for {ext_id}, skipping.")
                        continue

                    await conn.execute(
                        "INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)",
                        customer_id, business_id, None, reply, 0, 'DORMANT'
                    )
                    if ext_id not in conversations:
                        conversations[ext_id] = []
                    conversations[ext_id].append({"role": "assistant", "content": json.dumps({"reply": reply, "dormant_reengagement": True})})
                    print(f"Sent dormant re-engagement message to {ext_id}")

        except Exception as e:
            print(f"Dormant customer worker error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        try:
            db_pool = await asyncpg.create_pool(db_url, statement_cache_size=0)
            async with db_pool.acquire() as conn:
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS ext_id TEXT UNIQUE;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS followed_up_at TIMESTAMP;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS shop TEXT;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_id INT REFERENCES businesses(id);")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_whatsapp BOOLEAN DEFAULT FALSE;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_email BOOLEAN DEFAULT FALSE;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS state TEXT;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS tier TEXT;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC DEFAULT 0;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'chat';")
                await conn.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS business_id INT REFERENCES businesses(id);")
                await conn.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id INT REFERENCES businesses(id);")
                await conn.execute("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS banner_url TEXT;")
                await conn.execute("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS dormant_after_days INT DEFAULT 30;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS follow_up_stage INT DEFAULT 0;")
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS handoffs (
                        id SERIAL PRIMARY KEY,
                        customer_id INT REFERENCES customers(id),
                        reason TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                await conn.execute("ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS context_summary TEXT;")
                await conn.execute("ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS product_interest TEXT;")
                await conn.execute("ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS objection TEXT;")
                await conn.execute("ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS intent_score INT;")
                await conn.execute("ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS estimated_value NUMERIC;")
                await conn.execute("ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS urgency TEXT;")
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS admin_users (
                        id SERIAL PRIMARY KEY,
                        business_id INT REFERENCES businesses(id) ON DELETE CASCADE,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS retention_stages (
                        id SERIAL PRIMARY KEY,
                        order_id INT REFERENCES orders(id),
                        customer_id INT REFERENCES customers(id),
                        current_stage TEXT DEFAULT 'confirmed',
                        stage_updated_at TIMESTAMP DEFAULT NOW()
                    )
                """)
            print("Database connected and history loaded.")
        except Exception as e:
            print(f"Warning: Could not connect to database or load history. Using in-memory fallback. Error: {e}")
    else:
        print("Warning: DATABASE_URL not set. Using in-memory fallback.")
    
    worker_task = asyncio.create_task(follow_up_cadence_worker())
    retention_worker_task = asyncio.create_task(post_purchase_retention_worker())
    dormant_worker_task = asyncio.create_task(dormant_customer_worker())
    yield
    worker_task.cancel()
    retention_worker_task.cancel()
    dormant_worker_task.cancel()
    if db_pool:
        await db_pool.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if not os.path.exists("uploads"):
    os.makedirs("uploads")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/admin/login")
async def admin_login(req: LoginRequest):
    SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "superadmin@ai-sales.com")
    if req.email == SUPERADMIN_EMAIL and req.password == ADMIN_PASSWORD:
        payload = {"role": "admin", "exp": datetime.now(timezone.utc) + timedelta(days=7)}
        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
        return {"token": token}
        
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                user = await conn.fetchrow("""
                    SELECT u.id, u.business_id, u.password_hash, b.slug 
                    FROM admin_users u
                    JOIN businesses b ON u.business_id = b.id
                    WHERE u.email = $1
                """, req.email)
                
                if user and verify_password(req.password, user['password_hash']):
                    payload = {
                        "role": "admin", 
                        "business_id": user['business_id'],
                        "shop": user['slug'],
                        "exp": datetime.now(timezone.utc) + timedelta(days=7)
                    }
                    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
                    return {"token": token}
        except Exception as e:
            print(f"Error checking user credentials: {e}")
            
    raise HTTPException(status_code=401, detail="Invalid credentials")

class SignupRequest(BaseModel):
    business_name: str
    slug: Optional[str] = None
    owner_email: str
    password: str
    language: str
    policies: str
    banner_url: Optional[str] = None
    catalog_items: list[dict]

@app.post("/api/signup")
async def signup(req: SignupRequest):
    if not req.business_name or not req.owner_email:
        raise HTTPException(status_code=400, detail="Business name and owner email are required")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not req.catalog_items or len(req.catalog_items) == 0:
        raise HTTPException(status_code=400, detail="At least 1 product is required")
        
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.owner_email):
        raise HTTPException(status_code=400, detail="Invalid email format")
        
    slug = req.slug or re.sub(r'[^a-z0-9]+', '-', req.business_name.lower()).strip('-')
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid business name")
    
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        async with db_pool.acquire() as conn:
            existing_slug = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", slug)
            if existing_slug:
                raise HTTPException(status_code=400, detail="This name is taken")
                
            existing_email = await conn.fetchval("SELECT id FROM admin_users WHERE email = $1", req.owner_email)
            if existing_email:
                raise HTTPException(status_code=400, detail="An account with this email already exists")
                
            hashed_pw = get_password_hash(req.password)
            
            async with conn.transaction():
                business_id = await conn.fetchval("""
                    INSERT INTO businesses (slug, brand_name, language, policies, banner_url)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                """, slug, req.business_name, req.language, req.policies, req.banner_url)
                
                await conn.execute("""
                    INSERT INTO admin_users (business_id, email, password_hash)
                    VALUES ($1, $2, $3)
                """, business_id, req.owner_email, hashed_pw)
                
                for item in req.catalog_items:
                    await conn.execute("""
                        INSERT INTO catalog_items (business_id, name, price, note, image_url)
                        VALUES ($1, $2, $3, $4, $5)
                    """, business_id, item.get('name'), float(item.get('price', 0)), item.get('note', ''), item.get('image_url'))
            
            payload = {
                "role": "admin", 
                "business_id": business_id,
                "shop": slug,
                "exp": datetime.now(timezone.utc) + timedelta(days=7)
            }
            token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
            return {"token": token, "shop": slug}
            
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"Signup error: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

from fastapi.responses import JSONResponse
import traceback
import sys

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"Unhandled exception on {request.url}: {exc}", file=sys.stderr)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HandoffRequest(BaseModel):
    customerId: str
    reason: str

conversations = {}

async def load_config_from_db(slug: str, conn):
    business = await conn.fetchrow("""
        SELECT id, brand_name, language, policies, banner_url 
        FROM businesses WHERE slug = $1
    """, slug)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    items = await conn.fetch("""
        SELECT id, name, price, note, image_url 
        FROM catalog_items WHERE business_id = $1
        ORDER BY id ASC
    """, business['id'])
    
    return {
        "business_id": business['id'],
        "brandName": business['brand_name'],
        "language": business['language'],
        "policies": business['policies'],
        "bannerUrl": business.get('banner_url'),
        "catalog": [dict(i) for i in items]
    }

def detect_language(text: str) -> str:
    if re.search(r'[\u0A80-\u0AFF]', text):
        return 'Gujarati — reply ONLY in Gujarati script (ગુજરાતી)'
    if re.search(r'[\u0900-\u097F]', text):
        return 'Hindi — reply ONLY in Hindi (Devanagari) script'
    return 'English or Hinglish (Roman script) — if the customer mixed Hindi words in Roman letters, reply the same natural Hinglish way; if they wrote plain English, reply in plain English'

class ChatRequest(BaseModel):
    customerId: str
    message: str
    shop: Optional[str] = None
    ref: Optional[str] = None

@app.post("/api/voice-to-text")
async def voice_to_text(file: UploadFile = File(...)):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured")
        
    # Whisper hallucination phrases — these are generated from silence/noise
    HALLUCINATION_PHRASES = [
        "transcribe", "subscribe", "thank you for watching", "thanks for watching",
        "please subscribe", "like and subscribe", "video", "the video",
        "subtitles", "caption", "music", "applause", "laughter",
        "silence", "no speech", "inaudible", "thanks for listening",
        "please like", "see you next time", "bye bye", "goodbye",
        "thank you", "you", "the end", "end", "so", "okay",
        "अगर आपको", "सब्सक्राइब", "वीडियो", "लाइक",
    ]
    
    try:
        content = await file.read()
        # Reject very small audio files (likely just noise/click)
        if len(content) < 5000:
            return {"text": ""}
            
        async with httpx.AsyncClient() as client:
            files = {'file': (file.filename, content, file.content_type)}
            data = {
                'model': 'whisper-large-v3-turbo',
                'language': 'hi',
                'prompt': 'This is a customer speaking to a shopping assistant in India. They may speak in Hindi, Gujarati, Hinglish, or English. Transcribe exactly what they say. Do NOT add any commentary.'
            }
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files=files,
                data=data,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            transcribed_text = result.get("text", "").strip()
            
            # Filter out empty or too-short transcriptions
            if not transcribed_text or len(transcribed_text) < 3:
                return {"text": ""}
            
            # Filter out Whisper hallucinations
            text_lower = transcribed_text.lower().strip()
            for phrase in HALLUCINATION_PHRASES:
                if text_lower == phrase.lower() or text_lower.startswith(phrase.lower()):
                    print(f"Filtered Whisper hallucination: '{transcribed_text}'")
                    return {"text": ""}
            
            return {"text": transcribed_text}
    except Exception as e:
        print(f"Error in voice-to-text: {e}")
        raise HTTPException(status_code=500, detail="Failed to process audio")

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.customerId or not req.message:
        raise HTTPException(status_code=400, detail="customerId and message are required")

    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        config = await load_config_from_db(req.shop, conn)
        business_id = config['business_id']
        
        catalog_items = []
        for p in config.get("catalog", []):
            text = f"{p['name']} - ₹{p['price']} - {p['note']}"
            if "image_url" in p and p["image_url"]:
                text += f" (Image Link: {p['image_url']})"
            catalog_items.append(text)
        
        catalog_text = "\n".join(catalog_items)

        if req.customerId not in conversations:
            conversations[req.customerId] = []
        
        is_paused = False
        c_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", req.customerId)
        if c_id:
            pending = await conn.fetchval("SELECT id FROM handoffs WHERE customer_id = $1 AND status = 'pending'", c_id)
            if pending:
                is_paused = True
                await conn.execute(
                    "INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)",
                    c_id, business_id, req.message, None, 100, 'HOT'
                )
    history = conversations[req.customerId]
    
    if is_paused:
        history.append({"role": "user", "content": req.message})
        return {
            "reply": "⏳ Please wait, our store manager is reviewing your message...",
            "intent_score": 100,
            "segment": "HOT",
            "reasoning": "AI paused",
            "objection": None,
            "recommended_product": None,
            "next_action": "Wait for manager",
            "customer_name": None,
            "customer_phone": None,
            "needs_human": False,
            "handoff_reason": None,
            "order_ready": False,
            "order_product": None,
            "order_amount": None
        }
    opt_out_words = ["stop", "unsubscribe", "band karo", "mat bhejo", "no more messages", "do not message"]
    if any(w in req.message.lower() for w in opt_out_words):
        parsed = {
            "reply": "Understood, we won't send you promotional messages going forward.",
            "intent_score": 0, "segment": "COLD", "reasoning": "User opted out", "objection": None,
            "recommended_product": None, "next_action": "Opted out", "customer_name": None,
            "customer_phone": None, "needs_human": False, "handoff_reason": None,
            "requires_details": False, "order_ready": False, "order_product": None, "order_amount": None,
            "consent_whatsapp": False, "consent_email": False
        }
        history.append({"role": "user", "content": req.message})
        history.append({"role": "assistant", "content": json.dumps(parsed)})
        if db_pool:
            try:
                async with db_pool.acquire() as conn:
                    cid = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", req.customerId)
                    if cid:
                        await conn.execute("UPDATE customers SET consent_whatsapp = FALSE, consent_email = FALSE, opted_out = TRUE, segment = 'COLD', last_interaction = NOW() WHERE id = $1", cid)
                        await conn.execute("INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)", cid, business_id, req.message, parsed["reply"], 0, "COLD")
            except Exception as e:
                pass
        return parsed

    wallet_balance = 0
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE ext_id = $1", req.customerId)
                if bal: wallet_balance = float(bal)
        except Exception:
            pass

    detected_lang = detect_language(req.message)

    system_prompt = f"""You are the official AI Shopping Assistant for "{config.get('brandName')}" — a premium Indian brand.

🏷️ PRODUCT CATALOG:
{catalog_text}

📋 STORE POLICIES:
{config.get('policies')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CORE IDENTITY & TONE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- You are a warm, knowledgeable, and professional shopping assistant — NOT a generic chatbot.
- Talk like a real, experienced salesperson in a premium store: friendly, confident, helpful.
- Be conversational and human. Use the customer's name once you know it.
- NEVER sound robotic, repetitive, or overly formal. Vary your language naturally.
- Keep responses concise (2-4 sentences for simple queries, more only when listing products).
- Show genuine enthusiasm about the products you sell. You love this brand!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 LANGUAGE (CRITICAL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Detected language: {detected_lang}
- ALWAYS reply in the SAME language/script as the customer's message.
- If they write in Hindi (Devanagari script), reply in Hindi (Devanagari). 
- If they write in Hinglish (Hindi written using English/Latin alphabet like "kese ho"), you MUST reply in Hinglish using ONLY the English alphabet.
- CRITICAL: NEVER use Gurmukhi/Punjabi scripts or any other unrelated scripts.
- Sound native, conversational, and natural.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛍️ HOW TO RESPOND TO DIFFERENT SITUATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Greeting / First Message:**
- Welcome them warmly with the brand name. Mention 1-2 bestsellers or categories casually.
- Example: "Welcome to {config.get('brandName')}! 🎉 We've got some amazing [category] starting at just ₹[price]. What are you looking for today?"

**Product Inquiry (browsing):**
- Show relevant products from the catalog ONLY. Format beautifully with emojis.
- Each product: emoji + **Bold Name** — ₹Price, then a short description line.
- If product has an image link in catalog, MUST show it: `![Product Image](/images/...)`
- Add spacing between products using `\\n\\n`.
- End with a helpful question like "Would you like to know more about any of these?" or "Want me to check sizes?"

**Specific Product Question:**
- Answer EXACTLY what was asked. Don't dump the entire catalog.
- If they ask about a T-shirt, only talk about T-shirts. If they ask price, give the price directly.
- Be precise: "The Cotton T-Shirt is ₹599 — available in 5 colors and sizes S to XXL! 👕"

**Purchase Intent (wants to buy):**
- Get excited! Confirm their choice. IF the product typically requires a variant selection (like clothing size or shoe size), ask for it NATURALLY. If not (like most electronics or standard items), do NOT ask for size/color.
- Once product choices (if any) are finalized and the customer is ready to checkout, set `requires_details` to true to show the shipping form.
- Do NOT ask for name/phone/address in text when setting requires_details to true — the form handles that.

**Objections / Hesitation:**
- Address concerns empathetically. Highlight value, quality, return policy.
- "I totally understand! The quality of this fabric is premium — and we have hassle-free returns if it doesn't work out."

**Off-topic / Irrelevant Questions:**
- Politely redirect: "That's a great question! I'm specialized in helping you shop at {config.get('brandName')} though 😊 — anything I can help you find from our collection?"

**Angry / Frustrated Customer:**
- Be empathetic, acknowledge their frustration, and escalate.
- Set needs_human=true. Reply: "I completely understand your concern, and I want to make sure this gets resolved properly. Let me connect you with our store manager right away."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 FORMATTING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use markdown: **bold** for product names, emojis for visual appeal.
- Represent newlines inside JSON as `\\n`. NEVER press Enter inside a JSON string.
- Use `\\n\\n` between products for clean spacing.
- Prices: write plain numbers (599, not 1,099 or ₹5,99). No commas in numbers.
- Never invent products, prices, stock, delivery dates, or offers not in the catalog.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 SPECIAL FEATURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **COUPON 'FIRST10'**: If mentioned, get excited! Apply 10% discount. Show original → discounted price. Set order_amount to discounted price.
- **ORDER DETAILS FORM**: Set `requires_details` to true when customer is ready to checkout (preferences finalized). In your text reply, naturally ask for their name and city together (e.g. "Order ke liye apna naam aur city bata dijiye" or "Could you please share your name and city for the order?"). Do NOT ask as two separate awkward questions.
- **HUMAN HANDOFF**: Set `needs_human` to true + `handoff_reason` if: customer is angry, asks for human/manager, mentions legal/fraud/payment disputes, or asks something completely outside your knowledge.
- **ORDER CONFIRMATION**: ONLY set `order_ready` to true AFTER you have received the customer's Name, Phone, and Address from the shipping form. DO NOT set `order_ready` to true if you do not have their details yet. If they say "yes place order" but you don't have details, set `requires_details` to true to show the form first.
- **DPDP CONSENT**: When showing high purchase intent (setting requires_details or order_ready to true), naturally ask: "Would you like to receive future offers and updates via WhatsApp or email?" in the detected language. Set consent fields ONLY when customer explicitly responds.
- **CROSS-SELL/UPSELL**: Whenever you recommend or confirm a product, consider suggesting ONE complementary item from the catalog (e.g. jeans → belt, TV → HDMI cable). NEVER force a suggestion. **CRITICAL CULTURAL RULE:** Ensure cross-selling makes logical sense in Indian culture (e.g., NEVER suggest a leather belt with a Kurta or traditional wear). Weave the suggestion naturally into your reply (e.g. "A lot of customers also pick up X with this — want me to add that too?"). Set `cross_sell_product` to the name of the suggested product, otherwise null. Only suggest once per product.
- **WALLET DISCOUNT**: The customer currently has a Digital Wallet balance of ₹{wallet_balance}. If wallet balance > 0 and the user confirms an order, AUTOMATICALLY apply the wallet balance to reduce the total amount (deduct up to the order amount). You MUST output `wallet_discount_applied`: <amount_deducted> in your JSON. Also inform the user in your `reply` that you have applied their wallet balance.
- If customer mentions their name, city, or phone anywhere, acknowledge it and include in JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 LEAD SCORING (STRICT — score EVERY message):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score this customer's CURRENT state honestly across these 7 components — vary the numbers based on actual behavior, don't default to the same values every time:
- score_purchase_intent (0-30): browsing only=0-8, comparing options=9-18, ready to checkout=19-30
- score_product_interest (0-20): vague interest=0-6, asking specifics=7-14, comparing specific items=15-20
- score_engagement (0-15): one-word replies=0-5, asking questions=6-10, detailed back-and-forth=11-15
- score_recency (0-15): they're messaging right now, so usually 12-15 unless they've clearly gone quiet mid-conversation
- score_customer_fit (0-10): poor fit for this store's catalog=0-3, good fit=4-7, ideal fit=8-10
- score_purchase_history (0-5): never ordered=0, ordered once=3, repeat buyer=5
- score_estimated_value (0-5): low-value item=0-2, mid-value=3, high-value=4-5
Just fill in each component — do NOT add them up yourself, the system computes the total.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 OUTPUT FORMAT (STRICT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond with ONLY a raw JSON object (NO markdown fences, NO extra text) with exactly these fields:
{{
  "reply": "your professional customer-facing message",
  "score_purchase_intent": integer 0-30,
  "score_product_interest": integer 0-20,
  "score_engagement": integer 0-15,
  "score_recency": integer 0-15,
  "score_customer_fit": integer 0-10,
  "score_purchase_history": integer 0-5,
  "score_estimated_value": integer 0-5,
  "segment": "COLD" | "WARM" | "HOT" | "CUSTOMER",
  "reasoning": "one short sentence about customer intent",
  "objection": "short phrase or null",
  "recommended_product": "product name or null",
  "cross_sell_product": "complementary product name or null",
  "next_action": "short recommended next step",
  "customer_name": "extracted name or null",
  "customer_city": "extracted city or null",
  "customer_phone": "extracted phone or null",
  "needs_human": boolean,
  "handoff_reason": "reason string or null",
  "requires_details": boolean,
  "order_ready": boolean,
  "order_product": "product name being ordered or null",
  "order_amount": numeric price or null,
  "wallet_discount_applied": numeric amount deducted from wallet or 0,
  "consent_whatsapp": boolean or null,
  "consent_email": boolean or null
}}"""

    messages = [{"role": "system", "content": system_prompt}] + history[-12:] + [{"role": "user", "content": req.message}]

    data = None
    async with httpx.AsyncClient() as client:
        for attempt, current_model in enumerate(FALLBACK_MODELS):
            # Each model gets up to 3 retries with exponential backoff
            for retry in range(3):
                try:
                    groq_response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {GROQ_API_KEY}"
                        },
                        json={
                            "model": current_model,
                            "messages": messages,
                            "max_tokens": 1500,
                            "temperature": 0.4,
                        },
                        timeout=45.0
                    )
                    data = groq_response.json()
                    
                    if "error" in data:
                        error_msg = str(data["error"]).lower()
                        if "rate limit" in error_msg or "429" in error_msg or "resource_exhausted" in error_msg:
                            wait_time = (2 ** retry) * 1.5  # 1.5s, 3s, 6s
                            print(f"Rate limit on {current_model} (retry {retry+1}/3), waiting {wait_time}s...")
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            print(f"API error for {current_model}: {data['error']}")
                            break  # Non-rate-limit error, try next model
                    else:
                        break  # Success!
                except httpx.TimeoutException:
                    print(f"Timeout for {current_model} (retry {retry+1}/3)")
                    await asyncio.sleep(1)
                    continue
                except Exception as e:
                    print(f"Connection error for {current_model}: {e}")
                    await asyncio.sleep(1)
                    continue
            
            # If we got a successful response, stop trying models
            if data and "error" not in data:
                break

    if not data or "error" in data:
        error_detail = data["error"].get("message", "Groq API error") if data and "error" in data else "Groq API error"
        print("Groq error:", error_detail)
        fallback = {
            "reply": "I'm sorry, I am experiencing high traffic right now. Please wait a moment and try again. ⏳",
            "intent_score": 50, "segment": "WARM", "requires_details": False, "order_ready": False,
            "order_product": None, "order_amount": None
        }
        return fallback

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```\s*$', '', raw, flags=re.MULTILINE)
    raw = raw.strip()

    parsed = None
    
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        pass
    
    if parsed is None:
        try:
            start = raw.find('{')
            end = raw.rfind('}')
            if start != -1 and end != -1:
                json_str = raw[start:end+1]
                fixed = json_str.replace('\n', '<<<NL>>>')
                fixed = re.sub(r'<<<NL>>>', '\n', fixed)
                
                result = []
                in_string = False
                escape_next = False
                for ch in json_str:
                    if escape_next:
                        result.append(ch)
                        escape_next = False
                        continue
                    if ch == '\\':
                        escape_next = True
                        result.append(ch)
                        continue
                    if ch == '"':
                        in_string = not in_string
                        result.append(ch)
                        continue
                    if ch == '\n' and in_string:
                        result.append('\\n')
                        continue
                    if ch == '\r' and in_string:
                        continue
                    result.append(ch)
                
                fixed = ''.join(result)
                parsed = json.loads(fixed)
        except Exception as e2:
            pass
    
    if parsed is None:
        extracted_reply = "Main aapki madad karne ke liye yahan hoon! Kya aap apna question dubara pooch sakte hain?"
        try:
            reply_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', raw, re.DOTALL)
            if reply_match:
                extracted_reply = reply_match.group(1).replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"')
        except:
            pass

        parsed = {
            "reply": extracted_reply,
            "intent_score": 50,
            "segment": "WARM",
            "reasoning": "Could not parse AI response",
            "objection": None,
            "recommended_product": None,
            "cross_sell_product": None,
            "next_action": None,
            "customer_name": None,
            "customer_phone": None,
            "needs_human": False,
            "handoff_reason": None,
            "requires_details": False,
            "order_ready": False,
            "order_product": None,
            "order_amount": None,
            "consent_whatsapp": None,
            "consent_email": None,
        }

    # §6 Lead Scoring — total ko humara code calculate karta hai, LLM ka guess nahi lete
    if "score_purchase_intent" in parsed:
        def _clamp(val, lo, hi):
            try:
                return max(lo, min(hi, int(val)))
            except (TypeError, ValueError):
                return lo
        parsed["intent_score"] = (
            _clamp(parsed.get("score_purchase_intent"), 0, 30) +
            _clamp(parsed.get("score_product_interest"), 0, 20) +
            _clamp(parsed.get("score_engagement"), 0, 15) +
            _clamp(parsed.get("score_recency"), 0, 15) +
            _clamp(parsed.get("score_customer_fit"), 0, 10) +
            _clamp(parsed.get("score_purchase_history"), 0, 5) +
            _clamp(parsed.get("score_estimated_value"), 0, 5)
        )

    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": json.dumps(parsed)})
    
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                customer_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", req.customerId)
                c_name = parsed.get("customer_name")
                c_city = parsed.get("customer_city")
                c_phone = parsed.get("customer_phone")
                c_tier = get_city_tier(c_city) if c_city else None
                
                if parsed.get("order_ready"):
                    prior_orders = 0
                    if customer_id:
                        prior_orders = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE customer_id = $1", customer_id) or 0
                    parsed["segment"] = "REPEAT CUSTOMER" if prior_orders > 0 else "CUSTOMER"

                if customer_id:
                    total_orders = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE customer_id = $1", customer_id) or 0
                    if total_orders >= 2 and parsed.get("segment") != "DORMANT":
                        parsed["segment"] = "REPEAT CUSTOMER"

                if not customer_id:
                    ref_code = None
                    if req.ref:
                        ref_exists = await conn.fetchval("SELECT id FROM customers WHERE referral_code = $1", req.ref)
                        if ref_exists:
                            ref_code = req.ref
                            
                    c_source = 'referral' if ref_code else 'website'
                            
                    customer_id = await conn.fetchval(
                        "INSERT INTO customers (ext_id, name, phone, city, tier, source, segment, intent_score, shop, business_id, consent_whatsapp, consent_email, referred_by_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, FALSE), COALESCE($12, FALSE), $13) RETURNING id",
                        req.customerId, c_name, c_phone, c_city, c_tier, c_source, parsed.get("segment", "COLD"), parsed.get("intent_score", 0), req.shop, business_id, parsed.get("consent_whatsapp"), parsed.get("consent_email"), ref_code
                    )
                    
                    if ref_code:
                        referrer_id = await conn.fetchval("SELECT id FROM customers WHERE referral_code = $1", ref_code)
                        if referrer_id:
                            await conn.execute(
                                "INSERT INTO referrals (referrer_customer_id, referred_customer_id, referral_code, reward_status) VALUES ($1, $2, $3, 'pending')",
                                referrer_id, customer_id, ref_code
                            )
                else:
                    await conn.execute(
                        """
                        UPDATE customers 
                        SET segment = $1, 
                            intent_score = $2, 
                            last_interaction = NOW(),
                            name = COALESCE($4, name),
                            phone = COALESCE($5, phone),
                            shop = COALESCE($6, shop),
                            business_id = COALESCE($7, business_id),
                            consent_whatsapp = COALESCE($8, consent_whatsapp),
                            consent_email = COALESCE($9, consent_email),
                            city = COALESCE($10, city),
                            tier = COALESCE($11, tier),
                            followed_up_at = NULL,
                            follow_up_stage = 0
                        WHERE id = $3
                        """,
                        parsed.get("segment", "COLD"), 
                        parsed.get("intent_score", 0), 
                        customer_id,
                        c_name,
                        c_phone,
                        req.shop,
                        business_id,
                        parsed.get("consent_whatsapp"),
                        parsed.get("consent_email"),
                        c_city,
                        c_tier
                    )
                
                await conn.execute(
                    "INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)",
                    customer_id, business_id, req.message, parsed.get("reply", ""), parsed.get("intent_score", 0), parsed.get("segment", "COLD")
                )
                
                if parsed.get("needs_human"):
                    urgency = {"HOT": "High", "WARM": "Medium", "COLD": "Low", "CUSTOMER": "Medium"}.get(parsed.get("segment"), "Medium")
                    await conn.execute(
                        """
                        INSERT INTO handoffs (customer_id, business_id, reason, context_summary, product_interest, objection, intent_score, estimated_value, urgency)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        """,
                        customer_id, business_id, parsed.get("handoff_reason", "Customer requested human assistance"),
                        parsed.get("reasoning"), parsed.get("recommended_product"), parsed.get("objection"),
                        parsed.get("intent_score", 0), parsed.get("order_amount"), urgency
                    )
                
                if parsed.get("order_ready"):
                    import random
                    order_id = f"ORD-{random.randint(10000, 99999)}"
                    prod_name = parsed.get("order_product")
                    prod_id = None
                    if prod_name:
                        prod_id = await conn.fetchval("SELECT id FROM catalog_items WHERE business_id = $1 AND name ILIKE $2 LIMIT 1", business_id, f"%{prod_name}%")
                    
                    wallet_discount = float(parsed.get("wallet_discount_applied") or 0)
                    final_amount = float(parsed.get("order_amount") or 0)
                    
                    if wallet_discount > 0:
                        final_amount = max(0, final_amount - wallet_discount)
                        await conn.execute("UPDATE customers SET wallet_balance = GREATEST(0, wallet_balance - $1) WHERE id = $2", wallet_discount, customer_id)
                    
                    order_db_id = await conn.fetchval(
                        "INSERT INTO orders (customer_id, business_id, product_id, status, amount) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                        customer_id, business_id, prod_id, 'confirmed', final_amount
                    )
                    await conn.execute("INSERT INTO retention_stages (order_id, customer_id, current_stage) VALUES ($1, $2, 'confirmed')", order_db_id, customer_id)
                    parsed["order_id"] = order_id
                    parsed["order_amount"] = final_amount
                    parsed["wallet_discount_applied"] = wallet_discount
                    
                    # Generate or fetch referral code
                    cust_record = await conn.fetchrow("SELECT referral_code, referred_by_code, name FROM customers WHERE id = $1", customer_id)
                    ref_code = cust_record['referral_code'] if cust_record else None
                    name_prefix = (cust_record['name'] or "USR")[:3].upper() if cust_record else "USR"
                    
                    # Regenerate if not exists or if the name changed and the prefix no longer matches
                    if not ref_code or (ref_code != "USR" and not ref_code.startswith(name_prefix)):
                        ref_code = f"{name_prefix}{random.randint(1000, 9999)}"
                        await conn.execute("UPDATE customers SET referral_code = $1 WHERE id = $2", ref_code, customer_id)
                    
                    parsed["referral_code"] = ref_code
                    
                    # Update pending referral if this customer was referred
                    referred_by = cust_record['referred_by_code'] if cust_record else None
                    if referred_by:
                        ref_updated = await conn.execute(
                            "UPDATE referrals SET reward_status = 'earned', reward_amount = 100, referred_order_id = $1 WHERE referred_customer_id = $2 AND reward_status = 'pending'",
                            order_db_id, customer_id
                        )
                        if ref_updated == "UPDATE 1":
                            # Reward both referrer and friend
                            referrer_id = await conn.fetchval("SELECT id FROM customers WHERE referral_code = $1", referred_by)
                            if referrer_id:
                                await conn.execute("UPDATE customers SET wallet_balance = wallet_balance + 100 WHERE id = $1", referrer_id)
                            await conn.execute("UPDATE customers SET wallet_balance = wallet_balance + 100 WHERE id = $1", customer_id)
                            
                    # Update lifetime_value
                    await conn.execute("UPDATE customers SET lifetime_value = (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE customer_id = $1 AND status = 'confirmed') WHERE id = $1", customer_id)
                            
                # Always fetch latest wallet balance to send back to frontend
                latest_wallet = await conn.fetchval("SELECT wallet_balance FROM customers WHERE ext_id = $1", req.customerId)
                parsed["walletBalance"] = float(latest_wallet or 0)
                
        except Exception as e:
            print(f"Warning: Database error during chat save: {e}")

    return parsed

@app.get("/api/config")
async def get_config(shop: str = None):
    if not shop:
        raise HTTPException(status_code=400, detail="shop parameter is required")
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                return await load_config_from_db(shop, conn)
        except HTTPException as e:
            raise e
        except Exception as e:
            print(f"Error loading config: {e}")
            raise HTTPException(status_code=500, detail="Could not load business config")
    raise HTTPException(status_code=500, detail="Database not configured")

@app.get("/api/health")
def health():
    return {"status": "ok"}

# --- Image Upload Endpoint ---
@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    if not supabase_client:
        raise HTTPException(status_code=500, detail="Supabase Storage not configured.")
        
    try:
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        contents = await file.read()
        
        supabase_client.storage.from_("product-images").upload(
            unique_filename,
            contents,
            {"content-type": file.content_type}
        )
        
        public_url = supabase_client.storage.from_("product-images").get_public_url(unique_filename)
        
        if isinstance(public_url, str):
            return {"url": public_url}
        else:
            raise ValueError(f"Unexpected return type from get_public_url: {type(public_url)}")
            
    except Exception as e:
        print(f"Error during file upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image.")

@app.get("/api/analytics/segments")
async def get_analytics_segments(shop: Optional[str] = None, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                business_condition = ""
                if shop:
                    b_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", shop)
                    if b_id:
                        business_condition = f"WHERE business_id = {b_id}"
                        
                tier_counts = await conn.fetch(f"SELECT COALESCE(tier, 'Tier-3/Other') as tier, COUNT(*) as count FROM customers {business_condition} GROUP BY tier")
                source_counts = await conn.fetch(f"SELECT COALESCE(source, 'website') as source, COUNT(*) as count FROM customers {business_condition} GROUP BY source")
                top_customers = await conn.fetch(f"SELECT name, city, lifetime_value FROM customers {business_condition} ORDER BY lifetime_value DESC NULLS LAST LIMIT 5")
                
                return {
                    "tiers": [dict(t) for t in tier_counts],
                    "sources": [dict(s) for s in source_counts],
                    "top_customers": [dict(tc) for tc in top_customers]
                }
        except Exception as e:
            print(f"Warning: Database error fetching segments: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"tiers": [], "sources": [], "top_customers": []}


@app.get("/api/customers")
async def get_customers(shop: Optional[str] = None, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                if shop:
                    rows = await conn.fetch("""
                        SELECT c.id, c.ext_id, c.name, c.phone, c.segment, c.intent_score, c.last_interaction, b.slug as shop, c.consent_whatsapp, c.consent_email, c.wallet_balance, c.referral_code, c.city, c.tier, c.lifetime_value, c.source,
                               (SELECT current_stage FROM retention_stages WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) as retention_stage,
                               (SELECT amount FROM orders WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as latest_order_amount
                        FROM customers c
                        JOIN businesses b ON c.business_id = b.id
                        WHERE b.slug = $1
                        ORDER BY c.last_interaction DESC NULLS LAST
                    """, shop)
                else:
                    rows = await conn.fetch("""
                        SELECT c.id, c.ext_id, c.name, c.phone, c.segment, c.intent_score, c.last_interaction, b.slug as shop, c.consent_whatsapp, c.consent_email, c.wallet_balance, c.referral_code, c.city, c.tier, c.lifetime_value, c.source,
                               (SELECT current_stage FROM retention_stages WHERE customer_id = c.id ORDER BY id DESC LIMIT 1) as retention_stage,
                               (SELECT amount FROM orders WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as latest_order_amount
                        FROM customers c
                        LEFT JOIN businesses b ON c.business_id = b.id
                        ORDER BY c.last_interaction DESC NULLS LAST
                    """)
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Warning: Database error fetching customers: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

@app.get("/api/customers/{customer_id}/consent")
async def get_customer_consent(customer_id: int, _ = Depends(verify_admin)):
    if not db_pool:
        raise HTTPException(status_code=500, detail="DB not connected")
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT consent_whatsapp, consent_email FROM customers WHERE id = $1", customer_id)
        if not row:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {"whatsapp": row["consent_whatsapp"], "email": row["consent_email"]}

@app.get("/api/customers/{customer_id}/orders")
async def get_customer_orders(customer_id: int):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT o.id, o.status, o.amount, o.created_at, p.name as product_name
                    FROM orders o
                    LEFT JOIN catalog_items p ON o.product_id = p.id
                    WHERE o.customer_id = $1
                    ORDER BY o.created_at DESC
                """, customer_id)
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Warning: Database error fetching orders: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

@app.get("/api/orders/{order_id}/retention-stage")
async def get_retention_stage(order_id: int):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                stage = await conn.fetchval("SELECT current_stage FROM retention_stages WHERE order_id = $1 ORDER BY id DESC LIMIT 1", order_id)
                return {"stage": stage}
        except Exception as e:
            raise HTTPException(status_code=500, detail="Database error")
    return {"stage": None}

@app.get("/api/customers/{customer_id}/retention-stage")
async def get_customer_retention_stage(customer_id: int):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                stage = await conn.fetchval("SELECT current_stage FROM retention_stages WHERE customer_id = $1 ORDER BY id DESC LIMIT 1", customer_id)
                return {"stage": stage}
        except Exception as e:
            raise HTTPException(status_code=500, detail="Database error")
    return {"stage": None}

@app.get("/api/conversations/{customer_id}")
async def get_conversations(customer_id: int):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT message, reply, intent_score, segment, created_at 
                    FROM conversations 
                    WHERE customer_id = $1
                    ORDER BY created_at ASC
                """, customer_id)
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Warning: Database error fetching conversations: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

class HandoffRequest(BaseModel):
    customerId: str
    reason: str
    conversation_summary: str = ""

@app.post("/api/handoff")
async def request_handoff(req: HandoffRequest):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                customer_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", req.customerId)
                if customer_id:
                    cust = await conn.fetchrow("SELECT intent_score, segment FROM customers WHERE id = $1", customer_id)
                    urgency = {"HOT": "High", "WARM": "Medium", "COLD": "Low", "CUSTOMER": "Medium"}.get(cust["segment"] if cust else None, "Medium")
                    await conn.execute(
                        "INSERT INTO handoffs (customer_id, reason, context_summary, intent_score, urgency) VALUES ($1, $2, $3, $4, $5)",
                        customer_id, req.reason, req.conversation_summary or None, cust["intent_score"] if cust else 0, urgency
                    )
                    await conn.execute("UPDATE customers SET segment = 'HOT' WHERE id = $1", customer_id)
                return {"status": "success"}
        except Exception as e:
            print(f"Warning: Database error inserting handoff: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"status": "success"}

@app.get("/api/chat/poll/{customer_id}")
async def poll_chat(customer_id: str):
    wallet_balance = 0
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                bal = await conn.fetchval("SELECT wallet_balance FROM customers WHERE ext_id = $1", customer_id)
                if bal: wallet_balance = float(bal)
        except Exception:
            pass
    return {"messages": conversations.get(customer_id, []), "walletBalance": wallet_balance}

@app.delete("/api/chat/history/{customer_id}")
async def clear_chat_history(customer_id: str):
    # Just clear the in-memory chat so the UI becomes empty,
    # but DO NOT delete from the database so records are kept.
    if customer_id in conversations:
        conversations[customer_id] = []
            
    return {"status": "success"}

class ManagerReply(BaseModel):
    message: str

@app.post("/api/handoffs/{handoff_id}/reply")
async def manager_reply(handoff_id: int, req: ManagerReply, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT h.customer_id, c.ext_id, c.segment 
                    FROM handoffs h 
                    JOIN customers c ON c.id = h.customer_id 
                    WHERE h.id = $1
                """, handoff_id)
                if row:
                    ext_id = row['ext_id']
                    c_id = row['customer_id']
                    segment = row['segment']
                    
                    await conn.execute(
                        "INSERT INTO conversations (customer_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5)",
                        c_id, None, req.message, 100, segment
                    )
                    
                    if ext_id not in conversations:
                        conversations[ext_id] = []
                    conversations[ext_id].append({
                        "role": "assistant", 
                        "content": json.dumps({"reply": req.message})
                    })
                    return {"status": "success"}
        except Exception as e:
            print(f"Error in manager_reply: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"status": "error"}

@app.get("/api/handoffs")
async def get_handoffs(_ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT h.id, h.reason, h.status, h.created_at,
                           h.context_summary, h.product_interest, h.objection, h.intent_score, h.estimated_value, h.urgency,
                           c.name, c.phone,
                           (SELECT message FROM conversations WHERE customer_id = h.customer_id AND message IS NOT NULL ORDER BY created_at DESC LIMIT 1) as latest_message
                    FROM handoffs h
                    JOIN customers c ON h.customer_id = c.id
                    ORDER BY h.created_at DESC
                """)
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"Warning: Database error fetching handoffs: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

@app.get("/api/referrals")
async def get_referrals(shop: Optional[str] = None, admin: dict = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                business_id = None
                if shop:
                    business_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", shop)
                elif admin.get("business_id"):
                    business_id = admin["business_id"]
                
                query = """
                    SELECT r.id, r.referral_code, r.reward_status, r.reward_amount, r.created_at,
                           c1.name as referrer_name, c2.name as referred_name
                    FROM referrals r
                    JOIN customers c1 ON r.referrer_customer_id = c1.id
                    JOIN customers c2 ON r.referred_customer_id = c2.id
                """
                
                if business_id:
                    query += " WHERE c1.business_id = $1 ORDER BY r.created_at DESC"
                    rows = await conn.fetch(query, business_id)
                else:
                    query += " ORDER BY r.created_at DESC"
                    rows = await conn.fetch(query)
                
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"Warning: Database error fetching referrals: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

@app.post("/api/handoffs/{handoff_id}/resolve")
async def resolve_handoff(handoff_id: int, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("UPDATE handoffs SET status = 'resolved' WHERE id = $1", handoff_id)
                
                row = await conn.fetchrow("""
                    SELECT h.customer_id, c.ext_id, c.segment 
                    FROM handoffs h 
                    JOIN customers c ON c.id = h.customer_id 
                    WHERE h.id = $1
                """, handoff_id)
                
                if row:
                    ext_id = row['ext_id']
                    c_id = row['customer_id']
                    segment = row['segment']
                    
                    history = conversations.get(ext_id, [])
                    
                    system_prompt = """The human manager has resolved the customer's issue. Write a polite, short, and professional closing message from the AI thanking the customer and offering further assistance. 
CRITICAL RULE: You MUST write the message in the exact language and script that the customer used in the conversation history (e.g., Hindi, Hinglish, Gujarati, or English). 
Start the message with the ✅ emoji.
Return ONLY a raw JSON object with the "reply" field: {"reply": "your message"}"""
                    
                    messages = [{"role": "system", "content": system_prompt}] + history[-3:] 
                    
                    try:
                        async with httpx.AsyncClient() as client:
                            groq_response = await client.post(
                                "https://api.groq.com/openai/v1/chat/completions",
                                headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
                                json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 150, "temperature": 0.5},
                                timeout=10.0
                            )
                            data = groq_response.json()
                            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                            raw = re.sub(r'^```json', '', raw)
                            raw = re.sub(r'^```', '', raw)
                            raw = re.sub(r'```$', '', raw).strip()
                            parsed = json.loads(raw)
                            msg = parsed.get("reply", "✅ Your issue has been resolved by our manager. Let me know if you need further help!")
                    except Exception as e:
                        print(f"Error generating dynamic resolve message: {e}")
                        msg = "✅ Aapka issue manager dwara resolve kar diya gaya hai. Agar aapko aur koi help chahiye toh aap wapas mujhse pooch sakte hain!"
                    
                    await conn.execute(
                        "INSERT INTO conversations (customer_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5)",
                        c_id, None, msg, 100, segment
                    )
                    
                    if ext_id not in conversations:
                        conversations[ext_id] = []
                    conversations[ext_id].append({
                        "role": "assistant", 
                        "content": json.dumps({"reply": msg})
                    })
                    
                return {"status": "success"}
        except Exception as e:
            print(f"Warning: Database error resolving handoff: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"status": "success"}
@app.get("/api/admin/orders")
async def get_admin_orders(shop: Optional[str] = None, _ = Depends(verify_admin)):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        async with db_pool.acquire() as conn:
            if shop:
                orders_rows = await conn.fetch("""
                    SELECT 
                        o.id as order_id, 
                        o.amount, 
                        o.status, 
                        o.created_at,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        ci.name as product_name,
                        ci.image_url as product_image
                    FROM orders o
                    JOIN customers c ON o.customer_id = c.id
                    JOIN businesses b ON o.business_id = b.id
                    LEFT JOIN catalog_items ci ON o.product_id = ci.id
                    WHERE b.slug = $1
                    ORDER BY o.created_at DESC
                """, shop)
            else:
                orders_rows = await conn.fetch("""
                    SELECT 
                        o.id as order_id, 
                        o.amount, 
                        o.status, 
                        o.created_at,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        ci.name as product_name,
                        ci.image_url as product_image
                    FROM orders o
                    JOIN customers c ON o.customer_id = c.id
                    LEFT JOIN catalog_items ci ON o.product_id = ci.id
                    ORDER BY o.created_at DESC
                """)
            
            orders = []
            for r in orders_rows:
                orders.append({
                    "id": r["order_id"],
                    "amount": float(r["amount"] or 0),
                    "status": r["status"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "customer_name": r["customer_name"],
                    "customer_phone": r["customer_phone"],
                    "product_name": r["product_name"] or "Custom Order",
                    "product_image": r["product_image"]
                })
            
            return {"status": "success", "orders": orders}
    except Exception as e:
        print(f"Error fetching admin orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch orders")


@app.get("/api/analytics")
async def get_analytics(shop: Optional[str] = None, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                if shop:
                    total_conversations = await conn.fetchval("""
                        SELECT COUNT(DISTINCT conv.customer_id) 
                        FROM conversations conv
                        JOIN customers cus ON conv.customer_id = cus.id
                        JOIN businesses b ON cus.business_id = b.id
                        WHERE b.slug = $1
                    """, shop)
                    warm_or_above = await conn.fetchval("""
                        SELECT COUNT(c.id) FROM customers c 
                        JOIN businesses b ON c.business_id = b.id 
                        WHERE c.segment IN ('WARM', 'HOT', 'CUSTOMER') AND b.slug = $1
                    """, shop)
                    hot_or_above = await conn.fetchval("""
                        SELECT COUNT(c.id) FROM customers c 
                        JOIN businesses b ON c.business_id = b.id 
                        WHERE c.segment IN ('HOT', 'CUSTOMER') AND b.slug = $1
                    """, shop)
                    orders_placed = await conn.fetchval("""
                        SELECT COUNT(o.id) 
                        FROM orders o
                        JOIN customers cus ON o.customer_id = cus.id
                        JOIN businesses b ON cus.business_id = b.id
                        WHERE o.status = 'confirmed' AND b.slug = $1
                    """, shop)
                    avg_intent_score_val = await conn.fetchval("""
                        SELECT AVG(c.intent_score) FROM customers c
                        JOIN businesses b ON c.business_id = b.id
                        WHERE b.slug = $1
                    """, shop)
                    dormant_count = await conn.fetchval("""
                        SELECT COUNT(c.id) FROM customers c
                        JOIN businesses b ON c.business_id = b.id
                        WHERE c.segment = 'DORMANT' AND b.slug = $1
                    """, shop)
                    repeat_stats = await conn.fetchrow("""
                        SELECT
                            COUNT(*) FILTER (WHERE order_count >= 1) AS total_buyers,
                            COUNT(*) FILTER (WHERE order_count > 1) AS repeat_buyers
                        FROM (
                            SELECT o.customer_id, COUNT(*) AS order_count
                            FROM orders o
                            JOIN customers cus ON o.customer_id = cus.id
                            JOIN businesses b ON cus.business_id = b.id
                            WHERE o.status = 'confirmed' AND b.slug = $1
                            GROUP BY o.customer_id
                        ) sub
                    """, shop)
                else:
                    total_conversations = await conn.fetchval("SELECT COUNT(DISTINCT customer_id) FROM conversations")
                    warm_or_above = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment IN ('WARM', 'HOT', 'CUSTOMER')")
                    hot_or_above = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment IN ('HOT', 'CUSTOMER')")
                    orders_placed = await conn.fetchval("SELECT COUNT(id) FROM orders WHERE status = 'confirmed'")
                    avg_intent_score_val = await conn.fetchval("SELECT AVG(intent_score) FROM customers")
                    dormant_count = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment = 'DORMANT'")
                    repeat_stats = await conn.fetchrow("""
                        SELECT
                            COUNT(*) FILTER (WHERE order_count >= 1) AS total_buyers,
                            COUNT(*) FILTER (WHERE order_count > 1) AS repeat_buyers
                        FROM (
                            SELECT customer_id, COUNT(*) AS order_count
                            FROM orders WHERE status = 'confirmed'
                            GROUP BY customer_id
                        ) sub
                    """)

                conversion_rate = 0.0
                if total_conversations and total_conversations > 0:
                    conversion_rate = round((orders_placed / total_conversations) * 100, 1)
                
                avg_intent_score = round(avg_intent_score_val) if avg_intent_score_val else 0

                total_buyers = repeat_stats['total_buyers'] if repeat_stats else 0
                repeat_buyers = repeat_stats['repeat_buyers'] if repeat_stats else 0
                repeat_purchase_rate = round((repeat_buyers / total_buyers) * 100, 1) if total_buyers else 0.0

                return {
                    "total_conversations": total_conversations or 0,
                    "warm_or_above": warm_or_above or 0,
                    "hot_or_above": hot_or_above or 0,
                    "orders_placed": orders_placed or 0,
                    "conversion_rate": conversion_rate,
                    "avg_intent_score": avg_intent_score,
                    "dormant_customers": dormant_count or 0,
                    "repeat_purchase_rate": repeat_purchase_rate
                }
        except Exception as e:
            print(f"Warning: Database error fetching analytics: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {
        "total_conversations": 0,
        "warm_or_above": 0,
        "hot_or_above": 0,
        "orders_placed": 0,
        "conversion_rate": 0,
        "avg_intent_score": 0,
        "dormant_customers": 0,
        "repeat_purchase_rate": 0
    }

@app.get("/api/analytics/weekly")
async def get_weekly_analytics(shop: Optional[str] = None, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                if shop:
                    query = f"""
                        SELECT 
                            d.day,
                            COALESCE(leads.cnt, 0) AS leads,
                            COALESCE(hot.cnt, 0) AS hot,
                            COALESCE(ord.cnt, 0) AS orders
                        FROM (
                            SELECT generate_series(
                                (CURRENT_DATE - INTERVAL '6 days')::date,
                                CURRENT_DATE::date,
                                '1 day'::interval
                            )::date AS day
                        ) d
                        LEFT JOIN (
                            SELECT DATE(conv.created_at) AS day, COUNT(DISTINCT conv.customer_id) AS cnt
                            FROM conversations conv
                            JOIN customers c ON conv.customer_id = c.id
                            JOIN businesses b ON c.business_id = b.id
                            WHERE conv.created_at >= CURRENT_DATE - INTERVAL '6 days' AND b.slug = '{shop}'
                            GROUP BY DATE(conv.created_at)
                        ) leads ON leads.day = d.day
                        LEFT JOIN (
                            SELECT DATE(c.last_interaction) AS day, COUNT(*) AS cnt
                            FROM customers c
                            JOIN businesses b ON c.business_id = b.id
                            WHERE c.segment IN ('HOT', 'CUSTOMER')
                              AND c.last_interaction >= CURRENT_DATE - INTERVAL '6 days' AND b.slug = '{shop}'
                            GROUP BY DATE(c.last_interaction)
                        ) hot ON hot.day = d.day
                        LEFT JOIN (
                            SELECT DATE(o.created_at) AS day, COUNT(*) AS cnt
                            FROM orders o
                            JOIN customers c ON o.customer_id = c.id
                            JOIN businesses b ON c.business_id = b.id
                            WHERE o.status = 'confirmed'
                              AND o.created_at >= CURRENT_DATE - INTERVAL '6 days' AND b.slug = '{shop}'
                            GROUP BY DATE(o.created_at)
                        ) ord ON ord.day = d.day
                        ORDER BY d.day
                    """
                    rows = await conn.fetch(query)
                else:
                    rows = await conn.fetch("""
                        SELECT 
                            d.day,
                            COALESCE(leads.cnt, 0) AS leads,
                            COALESCE(hot.cnt, 0) AS hot,
                            COALESCE(ord.cnt, 0) AS orders
                        FROM (
                            SELECT generate_series(
                                (CURRENT_DATE - INTERVAL '6 days')::date,
                                CURRENT_DATE::date,
                                '1 day'::interval
                            )::date AS day
                        ) d
                        LEFT JOIN (
                            SELECT DATE(created_at) AS day, COUNT(DISTINCT customer_id) AS cnt
                            FROM conversations
                            WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
                            GROUP BY DATE(created_at)
                        ) leads ON leads.day = d.day
                        LEFT JOIN (
                            SELECT DATE(c.last_interaction) AS day, COUNT(*) AS cnt
                            FROM customers c
                            WHERE c.segment IN ('HOT', 'CUSTOMER')
                              AND c.last_interaction >= CURRENT_DATE - INTERVAL '6 days'
                            GROUP BY DATE(c.last_interaction)
                        ) hot ON hot.day = d.day
                        LEFT JOIN (
                            SELECT DATE(created_at) AS day, COUNT(*) AS cnt
                            FROM orders
                            WHERE status = 'confirmed'
                              AND created_at >= CURRENT_DATE - INTERVAL '6 days'
                            GROUP BY DATE(created_at)
                        ) ord ON ord.day = d.day
                        ORDER BY d.day
                    """)
                result = []
                day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                for row in rows:
                    day_date = row['day']
                    day_name = day_names[day_date.weekday()]
                    result.append({
                        "name": day_name,
                        "date": str(day_date),
                        "leads": row['leads'],
                        "hot": row['hot'],
                        "orders": row['orders']
                    })
                return result
        except Exception as e:
            print(f"Warning: Database error fetching weekly analytics: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

@app.get("/api/daily-report")
async def get_daily_report(shop: Optional[str] = None, date: Optional[str] = None, admin: dict = Depends(verify_admin)):
    """Daily Autonomous Report — Morning Snapshot style summary."""
    from datetime import date as date_type, datetime, timedelta, timezone
    
    # IST timezone (UTC+5:30)
    IST = timezone(timedelta(hours=5, minutes=30))
    
    # Parse target date (default: today in IST)
    if date:
        try:
            target_date = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = datetime.now(IST).date()
    
    # Convert target_date to UTC range for precise filtering
    day_start_ist = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=IST)
    day_end_ist = day_start_ist + timedelta(days=1)
    day_start_utc = day_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
    day_end_utc = day_end_ist.astimezone(timezone.utc).replace(tzinfo=None)
    
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        async with db_pool.acquire() as conn:
            # Determine business filter
            business_id = None
            if shop:
                business_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", shop)
                if not business_id:
                    raise HTTPException(status_code=404, detail="Shop not found")
            elif admin.get("business_id"):
                business_id = admin["business_id"]
            
            biz_filter_customers = "AND c.business_id = $3" if business_id else ""
            biz_filter_convos = "AND conv.business_id = $3" if business_id else ""
            biz_filter_orders = "AND o.business_id = $3" if business_id else ""
            biz_filter_handoffs_join = "JOIN customers c ON h.customer_id = c.id" if business_id else ""
            biz_filter_handoffs_where = "AND c.business_id = $1" if business_id else ""
            
            params_range_biz = [day_start_utc, day_end_utc, business_id] if business_id else [day_start_utc, day_end_utc]
            params_biz = [business_id] if business_id else []
            
            # 1. New leads today (customers first seen today in IST)
            new_leads = await conn.fetchval(f"""
                SELECT COUNT(*) FROM customers c
                WHERE c.created_at >= $1 AND c.created_at < $2 {biz_filter_customers}
            """, *params_range_biz)
            
            # 2. Hot prospects count (current)
            if business_id:
                hot_prospects = await conn.fetchval("""
                    SELECT COUNT(*) FROM customers c
                    WHERE c.segment = 'HOT' AND c.business_id = $1
                """, business_id)
            else:
                hot_prospects = await conn.fetchval(
                    "SELECT COUNT(*) FROM customers WHERE segment = 'HOT'"
                )
            
            # 2b. Dormant customers count (current) — §18/§22
            if business_id:
                dormant_customers_count = await conn.fetchval("""
                    SELECT COUNT(*) FROM customers c
                    WHERE c.segment = 'DORMANT' AND c.business_id = $1
                """, business_id)
            else:
                dormant_customers_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM customers WHERE segment = 'DORMANT'"
                )
            
            # 3. Pending handoffs count
            if business_id:
                pending_handoffs = await conn.fetchval("""
                    SELECT COUNT(*) FROM handoffs h
                    JOIN customers c ON h.customer_id = c.id
                    WHERE h.status = 'pending' AND c.business_id = $1
                """, business_id)
            else:
                pending_handoffs = await conn.fetchval(
                    "SELECT COUNT(*) FROM handoffs WHERE status = 'pending'"
                )
            
            # 3b. Pending follow-ups — leads currently due for their next §17 cadence touch,
            # using the same due-logic as follow_up_cadence_worker so the number is always accurate.
            pending_fu_sql = """
                SELECT COUNT(*) FROM customers c
                WHERE c.segment IN ('HOT', 'WARM', 'COLD')
                  AND c.opted_out = FALSE
                  {biz_clause}
                  AND (c.followed_up_at IS NULL OR c.followed_up_at < c.last_interaction)
                  AND c.follow_up_stage < (CASE c.segment WHEN 'HOT' THEN 4 ELSE 3 END)
                  AND c.last_interaction <= NOW() - (
                      CASE
                        WHEN c.segment = 'HOT'  AND c.follow_up_stage = 0 THEN INTERVAL '3 minutes'
                        WHEN c.segment = 'HOT'  AND c.follow_up_stage = 1 THEN INTERVAL '4 hours'
                        WHEN c.segment = 'HOT'  AND c.follow_up_stage = 2 THEN INTERVAL '24 hours'
                        WHEN c.segment = 'HOT'  AND c.follow_up_stage = 3 THEN INTERVAL '48 hours'
                        WHEN c.segment = 'WARM' AND c.follow_up_stage = 0 THEN INTERVAL '1 day'
                        WHEN c.segment = 'WARM' AND c.follow_up_stage = 1 THEN INTERVAL '3 days'
                        WHEN c.segment = 'WARM' AND c.follow_up_stage = 2 THEN INTERVAL '7 days'
                        WHEN c.segment = 'COLD' AND c.follow_up_stage = 0 THEN INTERVAL '7 days'
                        WHEN c.segment = 'COLD' AND c.follow_up_stage = 1 THEN INTERVAL '14 days'
                        WHEN c.segment = 'COLD' AND c.follow_up_stage = 2 THEN INTERVAL '30 days'
                      END
                  )
            """
            if business_id:
                pending_followups_count = await conn.fetchval(
                    pending_fu_sql.format(biz_clause="AND c.business_id = $1"), business_id
                )
            else:
                pending_followups_count = await conn.fetchval(
                    pending_fu_sql.format(biz_clause="")
                )
            
            # 4. Total conversations today (IST)
            total_convos = await conn.fetchval(f"""
                SELECT COUNT(*) FROM conversations conv
                WHERE conv.created_at >= $1 AND conv.created_at < $2 {biz_filter_convos}
            """, *params_range_biz)
            
            # 5. Orders today — ONLY confirmed orders within today's IST range
            order_row = await conn.fetchrow(f"""
                SELECT COUNT(*) as cnt, COALESCE(SUM(o.amount), 0) as revenue
                FROM orders o
                WHERE o.status = 'confirmed' AND o.created_at >= $1 AND o.created_at < $2 {biz_filter_orders}
            """, *params_range_biz)
            orders_today = order_row['cnt'] if order_row else 0
            revenue_today = float(order_row['revenue']) if order_row and order_row['revenue'] else 0.0
            
            # 6. Conversion rate
            conversion_rate = 0.0
            if total_convos and total_convos > 0:
                conversion_rate = round((orders_today / total_convos) * 100, 1)
            
            # 7. Avg intent score today (IST)
            avg_intent = await conn.fetchval(f"""
                SELECT AVG(conv.intent_score) FROM conversations conv
                WHERE conv.created_at >= $1 AND conv.created_at < $2 {biz_filter_convos}
            """, *params_range_biz)
            avg_intent_score = round(float(avg_intent), 1) if avg_intent else 0.0
            
            # 8. Segment breakdown
            if business_id:
                seg_rows = await conn.fetch("""
                    SELECT segment, COUNT(*) as cnt FROM customers
                    WHERE business_id = $1
                    GROUP BY segment ORDER BY cnt DESC
                """, business_id)
            else:
                seg_rows = await conn.fetch(
                    "SELECT segment, COUNT(*) as cnt FROM customers GROUP BY segment ORDER BY cnt DESC"
                )
            segment_breakdown = {row['segment']: row['cnt'] for row in seg_rows}
            
            # 9. Top products today — ONLY from confirmed orders within today's IST range
            top_products_rows = await conn.fetch(f"""
                SELECT ci.name, COUNT(*) as cnt
                FROM orders o
                JOIN catalog_items ci ON o.product_id = ci.id
                WHERE o.status = 'confirmed' AND o.created_at >= $1 AND o.created_at < $2 {biz_filter_orders}
                GROUP BY ci.name
                ORDER BY cnt DESC
                LIMIT 3
            """, *params_range_biz)
            top_products = [{"name": row['name'], "count": row['cnt']} for row in top_products_rows]
            
            return {
                "date": str(target_date),
                "new_leads_count": new_leads or 0,
                "hot_prospects_count": hot_prospects or 0,
                "dormant_customers_count": dormant_customers_count or 0,
                "pending_handoffs_count": pending_handoffs or 0,
                "pending_followups_count": pending_followups_count or 0,
                "total_conversations_today": total_convos or 0,
                "orders_today": orders_today,
                "revenue_today": revenue_today,
                "conversion_rate_today": conversion_rate,
                "avg_intent_score_today": avg_intent_score,
                "segment_breakdown": segment_breakdown,
                "top_products_today": top_products
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating daily report: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")

@app.get("/api/conversations/{customer_id}/latest")
async def get_latest_conversation(customer_id: str):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                c_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", customer_id)
                if not c_id:
                    return None
                row = await conn.fetchrow("""
                    SELECT message, reply, created_at, intent_score, segment
                    FROM conversations
                    WHERE customer_id = $1
                    ORDER BY created_at DESC
                    LIMIT 1
                """, c_id)
                if row:
                    return dict(row)
        except Exception as e:
            pass
    return None

@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: int):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("DELETE FROM conversations WHERE customer_id = $1", customer_id)
                await conn.execute("DELETE FROM retention_stages WHERE customer_id = $1", customer_id)
                await conn.execute("DELETE FROM referrals WHERE referrer_customer_id = $1 OR referred_customer_id = $1", customer_id)
                await conn.execute("DELETE FROM orders WHERE customer_id = $1", customer_id)
                await conn.execute("DELETE FROM handoffs WHERE customer_id = $1", customer_id)
                await conn.execute("DELETE FROM customers WHERE id = $1", customer_id)
                return {"status": "success", "message": "Customer deleted"}
        except Exception as e:
            print(f"Error deleting customer: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"status": "error", "message": "No DB connection"}

class CatalogItem(BaseModel):
    name: str
    price: float
    note: str = ""
    image_url: Optional[str] = None

class BusinessRequest(BaseModel):
    slug: str
    brand_name: str
    language: str
    policies: str
    catalog: list[CatalogItem] = []

@app.post("/api/businesses")
async def create_business(req: BusinessRequest):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        async with db_pool.acquire() as conn:
            business_id = await conn.fetchval("""
                INSERT INTO businesses (slug, brand_name, language, policies)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            """, req.slug, req.brand_name, req.language, req.policies)
            
            for item in req.catalog:
                await conn.execute("""
                    INSERT INTO catalog_items (business_id, name, price, note, image_url)
                    VALUES ($1, $2, $3, $4, $5)
                """, business_id, item.name, item.price, item.note, item.image_url)
                
            return {"success": True, "business_id": business_id, "slug": req.slug}
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="Database error during signup")

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@app.post("/api/admin/forgot-password-otp")
async def forgot_password_otp(req: ForgotPasswordRequest):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    async with db_pool.acquire() as conn:
        admin = await conn.fetchrow("SELECT id FROM admin_users WHERE email = $1", req.email)
        if not admin:
            raise HTTPException(status_code=404, detail="Email not found")
            
        import random
        otp = str(random.randint(1000, 9999))
        password_reset_otps[req.email] = otp
        
        # For demo purposes, we return the OTP in the response
        return {"status": "success", "message": "OTP generated", "demo_otp": otp}

@app.post("/api/admin/reset-password-with-otp")
async def reset_password_with_otp(req: ResetPasswordRequest):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    stored_otp = password_reset_otps.get(req.email)
    if not stored_otp or stored_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
    hashed_pw = pwd_context.hash(req.new_password)
    
    async with db_pool.acquire() as conn:
        await conn.execute("UPDATE admin_users SET password_hash = $1 WHERE email = $2", hashed_pw, req.email)
        
    # Clear the OTP after successful reset
    del password_reset_otps[req.email]
    
    return {"status": "success", "message": "Password updated successfully"}

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.post("/api/admin/change-password")
async def change_password(req: ChangePasswordRequest, admin: dict = Depends(verify_admin)):
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    business_id = admin.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="Cannot change master password from here. Please use .env")
        
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, password_hash FROM admin_users WHERE business_id = $1", business_id)
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
            
        if req.old_password != ADMIN_PASSWORD and not verify_password(req.old_password, user['password_hash']):
            raise HTTPException(status_code=400, detail="Incorrect current password")
            
        new_hash = get_password_hash(req.new_password)
        await conn.execute("UPDATE admin_users SET password_hash = $1 WHERE id = $2", new_hash, user['id'])
        
    return {"success": True, "message": "Password updated successfully"}

class ForceResetRequest(BaseModel):
    slug: str
    new_password: str

@app.post("/api/admin/force-reset-shop")
async def force_reset_shop(req: ForceResetRequest, admin: dict = Depends(verify_admin)):
    if admin.get("role") != "admin" or admin.get("business_id") is not None:
        raise HTTPException(status_code=403, detail="Only Superadmin can force reset shop passwords")
        
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        business_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", req.slug)
        if not business_id:
            raise HTTPException(status_code=404, detail="Shop not found")
            
        new_hash = get_password_hash(req.new_password)
        res = await conn.execute("UPDATE admin_users SET password_hash = $1 WHERE business_id = $2", new_hash, business_id)
        if res == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Shop user not found")
            
    return {"success": True, "message": "Shop password reset successfully"}

class CatalogRequest(BaseModel):
    catalog: list[dict]



@app.put("/api/businesses/{slug}/catalog")
async def update_catalog(slug: str, items: list[CatalogItem], credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        admin_business_id = payload.get("business_id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        async with db_pool.acquire() as conn:
            business = await conn.fetchrow("SELECT id FROM businesses WHERE slug = $1", slug)
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
                
            business_id = business['id']
            if admin_business_id != business_id:
                raise HTTPException(status_code=403, detail="Not authorized to edit this business's catalog")
                
            async with conn.transaction():
                await conn.execute("DELETE FROM catalog_items WHERE business_id = $1", business_id)
                for item in items:
                    await conn.execute("""
                        INSERT INTO catalog_items (business_id, name, price, note, image_url)
                        VALUES ($1, $2, $3, $4, $5)
                    """, business_id, item.name, item.price, item.note, item.image_url)
            return {"status": "success", "message": "Catalog updated"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error updating catalog: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.post("/api/businesses/{slug}/catalog")
async def add_catalog_item(slug: str, item: CatalogItem, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        admin_business_id = payload.get("business_id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        async with db_pool.acquire() as conn:
            business = await conn.fetchrow("SELECT id FROM businesses WHERE slug = $1", slug)
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
                
            business_id = business['id']
            if admin_business_id != business_id:
                raise HTTPException(status_code=403, detail="Not authorized to edit this business's catalog")
                
            item_id = await conn.fetchval("""
                INSERT INTO catalog_items (business_id, name, price, note, image_url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            """, business_id, item.name, item.price, item.note, item.image_url)
            return {"status": "success", "id": item_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"Error adding catalog item: {e}\n{err_msg}")
        raise HTTPException(status_code=500, detail=f"{str(e)}\n{err_msg}")

@app.put("/api/businesses/{slug}/catalog/{item_id}")
async def edit_catalog_item(slug: str, item_id: int, item: CatalogItem, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        admin_business_id = payload.get("business_id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        async with db_pool.acquire() as conn:
            business = await conn.fetchrow("SELECT id FROM businesses WHERE slug = $1", slug)
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
                
            business_id = business['id']
            if admin_business_id != business_id:
                raise HTTPException(status_code=403, detail="Not authorized to edit this business's catalog")
                
            await conn.execute("""
                UPDATE catalog_items
                SET name = $1, price = $2, note = $3, image_url = $4
                WHERE id = $5 AND business_id = $6
            """, item.name, item.price, item.note, item.image_url, item_id, business_id)
            return {"status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error editing catalog item: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.delete("/api/businesses/{slug}/catalog/{item_id}")
async def delete_catalog_item(slug: str, item_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        admin_business_id = payload.get("business_id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        async with db_pool.acquire() as conn:
            business = await conn.fetchrow("SELECT id FROM businesses WHERE slug = $1", slug)
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
                
            business_id = business['id']
            if admin_business_id != business_id:
                raise HTTPException(status_code=403, detail="Not authorized to edit this business's catalog")
                
            await conn.execute("DELETE FROM catalog_items WHERE id = $1 AND business_id = $2", item_id, business_id)
            return {"status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error deleting catalog item: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.get("/api/businesses")
async def get_all_businesses(_ = Depends(verify_admin)):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                b.slug as id, b.brand_name as name,
                (SELECT count(*) FROM customers WHERE business_id = b.id) as customers_count,
                (SELECT count(*) FROM conversations WHERE business_id = b.id) as chats_count
            FROM businesses b
            ORDER BY b.created_at ASC
        """)
        return [dict(r) for r in rows]

@app.delete("/api/businesses/{slug}")
async def delete_business(slug: str, admin: dict = Depends(verify_admin)):
    # Check if super admin (only super admin lacks 'shop'/'business_id' in payload)
    if admin.get("shop") and admin.get("shop") != "master":
        raise HTTPException(status_code=403, detail="Only Super Admin can delete businesses")
    
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        # 1. Find business ID
        biz_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", slug)
        if not biz_id:
            raise HTTPException(status_code=404, detail="Business not found")
            
        # 2. Get customer IDs
        customer_ids = [r['id'] for r in await conn.fetch("SELECT id FROM customers WHERE business_id = $1", biz_id)]
        
        # 3. Delete related data in reverse order of foreign key dependencies
        if customer_ids:
            await conn.execute("DELETE FROM orders WHERE customer_id = ANY($1::int[])", customer_ids)
            await conn.execute("DELETE FROM conversations WHERE customer_id = ANY($1::int[])", customer_ids)
            await conn.execute("DELETE FROM handoffs WHERE customer_id = ANY($1::int[])", customer_ids)
            
        await conn.execute("DELETE FROM customers WHERE business_id = $1", biz_id)
        await conn.execute("DELETE FROM catalog_items WHERE business_id = $1", biz_id)
        await conn.execute("DELETE FROM admin_users WHERE business_id = $1", biz_id)
        await conn.execute("DELETE FROM businesses WHERE id = $1", biz_id)
        
        return {"status": "success", "message": f"Business '{slug}' successfully deleted"}

@app.get("/api/public/businesses")
async def get_public_businesses():
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                b.slug, b.brand_name, b.language, b.banner_url,
                (SELECT count(*) FROM catalog_items WHERE business_id = b.id) as product_count,
                (SELECT min(price) FROM catalog_items WHERE business_id = b.id) as min_price,
                (SELECT max(price) FROM catalog_items WHERE business_id = b.id) as max_price
            FROM businesses b
            ORDER BY b.created_at ASC
        """)
        
        stores = []
        for idx, r in enumerate(rows):
            stores.append({
                "slug": r["slug"],
                "name": r["brand_name"],
                "language": r["language"],
                "banner_url": r.get("banner_url"),
                "product_count": r["product_count"] or 0,
                "min_price": float(r['min_price'] or 0),
                "max_price": float(r['max_price'] or 0),
                "idx": idx
            })
            
        return stores

class ContentIdeaRequest(BaseModel):
    business_slug: str
    product_name: Optional[str] = None
    content_type: Optional[str] = None

@app.post("/api/content-ideas")
async def generate_content_ideas(req: ContentIdeaRequest, admin: dict = Depends(verify_admin)):
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if not db_pool or not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Database or LLM API not configured")
        
    async with db_pool.acquire() as conn:
        business = await conn.fetchrow("SELECT brand_name, language FROM businesses WHERE slug = $1", req.business_slug)
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
            
        brand_name = business['brand_name']
        lang = business['language'] or 'Hinglish'
        
    product_target = req.product_name if req.product_name and req.product_name != 'All Products' else "their catalog in general"
    content_target = req.content_type if req.content_type and req.content_type != 'Mix' else "a mix of Instagram Reel, Post, Story, Offer, or Festival content"

    system_prompt = f"""
You are a social media content strategist for an Indian B2C brand called {brand_name}.
Generate 4 short, ready-to-use content ideas for {product_target} targeting Indian consumers.
Format required: {content_target}.
For each idea include:
- format: the content format (e.g. Instagram Reel, Post, Story, Offer)
- caption: a short catchy caption/hook (in {lang})
- why_it_works: one line on why it would work (can be in English or {lang}). Tie to upcoming Indian festivals/seasons if relevant.

Return ONLY a valid JSON array of objects with fields: format, caption, why_it_works. Do not include markdown blocks like ```json.
"""

    messages = [{"role": "user", "content": system_prompt}]
    
    async with httpx.AsyncClient() as client:
        data = None
        for current_model in FALLBACK_MODELS:
            try:
                groq_response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {GROQ_API_KEY}"
                    },
                    json={
                        "model": current_model,
                        "messages": messages,
                        "max_tokens": 1500,
                        "temperature": 0.7,
                    },
                    timeout=30.0
                )
                data = groq_response.json()
                if "error" in data and "rate limit" in str(data["error"]).lower():
                    continue
                if "error" in data:
                    continue
                break
            except Exception as e:
                continue

    if not data or "error" in data:
        raise HTTPException(status_code=500, detail=data["error"].get("message", "Groq API error") if data and "error" in data else "Could not reach Groq API")

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    
    # Strip markdown formatting for JSON parsing
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```\s*$', '', raw, flags=re.MULTILINE)
    raw = raw.strip()

    try:
        ideas = json.loads(raw)
        if not isinstance(ideas, list):
            ideas = [ideas]
        return {"status": "success", "ideas": ideas[:4]}
    except json.JSONDecodeError:
        print(f"Failed to parse Groq response: {raw}")
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")
