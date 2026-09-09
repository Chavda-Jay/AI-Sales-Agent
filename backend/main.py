import os
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
supabase_client = None
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "qwen/qwen3.8-27b"

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-default-key-for-demo")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

security = HTTPBearer()

def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def abandoned_chat_worker():
    while True:
        await asyncio.sleep(30)
        if not db_pool or not GROQ_API_KEY:
            continue
            
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT c.id, c.ext_id, c.name, c.segment, b.slug as shop_slug, c.business_id
                    FROM customers c
                    JOIN businesses b ON c.business_id = b.id
                    WHERE c.segment IN ('WARM', 'HOT')
                      AND c.last_interaction < NOW() - INTERVAL '90 seconds'
                      AND (c.followed_up_at IS NULL OR c.followed_up_at < c.last_interaction)
                """)
                for row in rows:
                    customer_id = row['id']
                    ext_id = row['ext_id']
                    
                    try:
                        config = await load_config_from_db(row['shop_slug'], conn)
                    except:
                        continue
                    
                    system_prompt = f"""You are an AI sales agent for {config.get('brandName')}.
Language: {config.get('language')}
The customer was interested (segment: {row['segment']}) but went silent.
Write a very short, natural follow-up message to re-engage them. 
Return ONLY raw JSON: {{"reply": "your message"}}
"""
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": "The customer has been inactive for a few minutes. Please generate a short follow-up message to re-engage them."}
                    ]
                    
                    async with httpx.AsyncClient() as client:
                        try:
                            groq_response = await client.post(
                                "https://api.groq.com/openai/v1/chat/completions",
                                headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
                                json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 100, "temperature": 0.7},
                                timeout=10.0
                            )
                            data = groq_response.json()
                            if "error" in data:
                                print(f"API Error for {ext_id}: {data['error']}")
                                continue
                            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                            if not raw:
                                print(f"API returned empty response for {ext_id}")
                                continue
                            raw = re.sub(r'^```json', '', raw)
                            raw = re.sub(r'^```', '', raw)
                            raw = re.sub(r'```$', '', raw).strip()
                            try:
                                parsed = json.loads(raw)
                            except json.JSONDecodeError:
                                print(f"Invalid JSON returned for {ext_id}: {raw}")
                                continue
                                
                            reply = parsed.get("reply", "Hi, are you still there? Let me know if you need help!")
                            
                            await conn.execute(
                                "INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)",
                                customer_id, row['business_id'], None, reply, 0, row['segment']
                            )
                            await conn.execute("UPDATE customers SET followed_up_at = NOW() WHERE id = $1", customer_id)
                            print(f"Sent proactive follow up to {ext_id}")
                        except Exception as e:
                            print(f"Failed to generate follow up for {ext_id}: {e}")
                            
        except Exception as e:
            print(f"Abandoned chat worker error: {e}")

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
                await conn.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS business_id INT REFERENCES businesses(id);")
                await conn.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id INT REFERENCES businesses(id);")
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS handoffs (
                        id SERIAL PRIMARY KEY,
                        customer_id INT REFERENCES customers(id),
                        reason TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS admin_users (
                        id SERIAL PRIMARY KEY,
                        business_id INT REFERENCES businesses(id) ON DELETE CASCADE,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """)
            print("Database connected and history loaded.")
        except Exception as e:
            print(f"Warning: Could not connect to database or load history. Using in-memory fallback. Error: {e}")
    else:
        print("Warning: DATABASE_URL not set. Using in-memory fallback.")
    
    worker_task = asyncio.create_task(abandoned_chat_worker())
    yield
    worker_task.cancel()
    if db_pool:
        await db_pool.close()

app = FastAPI(lifespan=lifespan)

if not os.path.exists("uploads"):
    os.makedirs("uploads")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

class LoginRequest(BaseModel):
    password: str
    shop: Optional[str] = None
    email: Optional[str] = None

@app.post("/api/admin/login")
async def admin_login(req: LoginRequest):
    if req.password == ADMIN_PASSWORD and req.shop:
        payload = {"role": "admin", "exp": datetime.now(timezone.utc) + timedelta(days=7)}
        
        if req.shop != "master" and db_pool:
            try:
                async with db_pool.acquire() as conn:
                    business_id = await conn.fetchval("SELECT id FROM businesses WHERE slug = $1", req.shop)
                    if business_id:
                        payload["business_id"] = business_id
                        payload["shop"] = req.shop
            except Exception as e:
                print(f"Error fetching business_id for login: {e}")

        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
        return {"token": token}
        
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                user = None
                if req.email:
                    user = await conn.fetchrow("""
                        SELECT u.id, u.business_id, u.password_hash, b.slug 
                        FROM admin_users u
                        JOIN businesses b ON u.business_id = b.id
                        WHERE u.email = $1
                    """, req.email)
                elif req.shop and req.shop != "master":
                    user = await conn.fetchrow("""
                        SELECT u.id, u.business_id, u.password_hash, b.slug 
                        FROM admin_users u
                        JOIN businesses b ON u.business_id = b.id
                        WHERE b.slug = $1
                    """, req.shop)
                    
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
                    INSERT INTO businesses (slug, brand_name, language, policies)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                """, slug, req.business_name, req.language, req.policies)
                
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
        SELECT id, brand_name, language, policies 
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

    detected_lang = detect_language(req.message)

    system_prompt = f"""You are an AI B2C sales agent for the Indian brand "{config.get('brandName')}".
Product catalog:
{catalog_text}

Policies: {config.get('policies')}

Language rule (very important, follow exactly):
- The customer's current message language has been detected as: {detected_lang}
- Write your "reply" field in that exact language/script. Do not translate to a different language than instructed.
- Keep it natural and native-sounding, not a literal word-for-word translation.

Rules:
- **FORMATTING (CRITICAL):** You must format your response beautifully and professionally.
  1. When listing products, use a NUMBERED LIST with emojis. Format each product EXACTLY like this example:
     `1. 👕 **Cotton T-Shirt** — ₹599\\nSoft everyday wear, 5 colors available\\n\\n![Image](/images/cotton_tshirt.jpg)\\n\\n2. 👖 **Slim Fit Jeans** — ₹1299\\nStretch denim, all sizes\\n\\n![Image](/images/slim_jeans.jpg)\\n\\n`
  2. Each product MUST be on its own numbered line with: emoji, **bold name**, dash (—), price on the first line. Description on the next line.
  3. If an "(Image Link: /images/...)" is provided in the catalog for a product, YOU MUST display it using markdown `![Product Image](/images/...)` directly below the product description. This is mandatory for a rich user experience!
  4. Add a friendly greeting line BEFORE the product list and a helpful closing line AFTER it.
  5. Inside the JSON string, represent newlines as `\\n`. NEVER press Enter inside a JSON string.
  6. Use double `\\n\\n` between products for clean spacing.
  7. Keep prices as plain numbers (e.g., 599, NOT ₹5,99 or 1,299).
- Never invent prices, stock, delivery dates or offers not listed above.
- Be helpful, concise, human, persuasive without being pushy.
- Ask only necessary questions to narrow a recommendation.
- **NUMBER FORMATTING:** Do NOT use commas in prices or numbers in your 'reply' (e.g., write 1098, not 1,098 or 10,098).
- Answer strictly and perfectly according to what the customer asks. Do not make illogical product suggestions (e.g., never suggest a leather belt with a silk saree).
- **COUPON/DISCOUNT:** If the customer mentions the coupon code 'FIRST10', acknowledge it excitedly and apply a 10% discount to their purchase. When setting 'order_amount' in the JSON, calculate and provide the discounted price. Clearly mention the discount applied in your 'reply'.
- When the customer shows clear purchase intent, ask them for their product preferences (like Size or Color) in the chat if applicable. Do not make assumptions (e.g. sneakers need numeric sizes, shirts need S/M/L).
- **ORDER DETAILS FORM:** Once product preferences are finalized and the customer is ready to checkout, set `"requires_details"` to `true`. This will show a shipping form (Name, Phone, Address) in their chat window. Do not manually ask for their name/phone in your text reply if you are setting this to true; let the form do it.
- If the customer mentions their name or phone number anywhere in the conversation, acknowledge it naturally and include it in your JSON response.
- HUMAN HANDOFF: If the customer sounds angry/frustrated, asks for a human/manager, mentions legal/fraud/payment disputes, asks for an extreme discount/exception, or asks a question completely outside your catalog/policy knowledge, set "needs_human" to true and provide a short "handoff_reason". Acknowledge this naturally in your "reply" (e.g. "I'll connect you with our team right away for this."). Otherwise, set "needs_human" to false and "handoff_reason" to null.
- ORDER CONFIRMATION: If the customer clearly confirms they want to place an order (e.g., "order confirm karo", "yes place my order"), set "order_ready" to true, and provide the "order_product" and "order_amount" (numeric price). Otherwise, set these to false/null.

After reading the conversation, respond with ONLY a raw JSON object (no markdown fences) with exactly:
{{
  "reply": "the customer-facing chat message",
  "intent_score": integer 0-100,
  "segment": "COLD" | "WARM" | "HOT" | "CUSTOMER",
  "reasoning": "one short sentence",
  "objection": "short phrase or null",
  "recommended_product": "product name or null",
  "next_action": "short recommended action",
  "customer_name": "extracted name or null",
  "customer_phone": "extracted phone number or null",
  "needs_human": boolean,
  "handoff_reason": "reason string or null",
  "requires_details": boolean,
  "order_ready": boolean,
  "order_product": "product name being ordered or null",
  "order_amount": numeric price or null
}}"""

    messages = [{"role": "system", "content": system_prompt}] + history[-6:] + [{"role": "user", "content": req.message}]

    async with httpx.AsyncClient() as client:
        try:
            groq_response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY}"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "max_tokens": 1000,
                    "temperature": 0.5,
                },
                timeout=30.0
            )
            data = groq_response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail="Could not reach Groq API")

    if "error" in data:
        print("Groq error:", data["error"])
        raise HTTPException(status_code=500, detail=data["error"].get("message", "Groq API error"))

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
        extracted_reply = "I'd be happy to help! Could you please ask me again?"
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
            "next_action": None,
            "customer_name": None,
            "customer_phone": None,
            "needs_human": False,
            "handoff_reason": None,
            "requires_details": False,
            "order_ready": False,
            "order_product": None,
            "order_amount": None,
        }

    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": json.dumps(parsed)})
    
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                customer_id = await conn.fetchval("SELECT id FROM customers WHERE ext_id = $1", req.customerId)
                c_name = parsed.get("customer_name")
                c_phone = parsed.get("customer_phone")
                
                if parsed.get("order_ready"):
                    parsed["segment"] = "CUSTOMER"

                if not customer_id:
                    customer_id = await conn.fetchval(
                        "INSERT INTO customers (ext_id, name, phone, segment, intent_score, shop, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
                        req.customerId, c_name, c_phone, parsed.get("segment", "COLD"), parsed.get("intent_score", 0), req.shop, business_id
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
                            followed_up_at = NULL
                        WHERE id = $3
                        """,
                        parsed.get("segment", "COLD"), 
                        parsed.get("intent_score", 0), 
                        customer_id,
                        c_name,
                        c_phone,
                        req.shop,
                        business_id
                    )
                
                await conn.execute(
                    "INSERT INTO conversations (customer_id, business_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5, $6)",
                    customer_id, business_id, req.message, parsed.get("reply", ""), parsed.get("intent_score", 0), parsed.get("segment", "COLD")
                )
                
                if parsed.get("needs_human"):
                    await conn.execute(
                        "INSERT INTO handoffs (customer_id, business_id, reason) VALUES ($1, $2, $3)",
                        customer_id, business_id, parsed.get("handoff_reason", "Customer requested human assistance")
                    )
                
                if parsed.get("order_ready"):
                    import random
                    order_id = f"ORD-{random.randint(10000, 99999)}"
                    prod_name = parsed.get("order_product")
                    prod_id = None
                    if prod_name:
                        prod_id = await conn.fetchval("SELECT id FROM catalog_items WHERE business_id = $1 AND name ILIKE $2 LIMIT 1", business_id, f"%{prod_name}%")
                    
                    await conn.execute(
                        "INSERT INTO orders (customer_id, business_id, product_id, status, amount) VALUES ($1, $2, $3, $4, $5)",
                        customer_id, business_id, prod_id, 'confirmed', parsed.get("order_amount")
                    )
                    parsed["order_id"] = order_id
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

@app.get("/api/customers")
async def get_customers(shop: Optional[str] = None, _ = Depends(verify_admin)):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                if shop:
                    rows = await conn.fetch("""
                        SELECT c.id, c.ext_id, c.name, c.phone, c.segment, c.intent_score, c.last_interaction, b.slug as shop
                        FROM customers c
                        JOIN businesses b ON c.business_id = b.id
                        WHERE b.slug = $1
                        ORDER BY c.last_interaction DESC NULLS LAST
                    """, shop)
                else:
                    rows = await conn.fetch("""
                        SELECT c.id, c.ext_id, c.name, c.phone, c.segment, c.intent_score, c.last_interaction, b.slug as shop
                        FROM customers c
                        LEFT JOIN businesses b ON c.business_id = b.id
                        ORDER BY c.last_interaction DESC NULLS LAST
                    """)
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Warning: Database error fetching customers: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return []

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
                    await conn.execute(
                        "INSERT INTO handoffs (customer_id, reason) VALUES ($1, $2)",
                        customer_id, req.reason
                    )
                    await conn.execute("UPDATE customers SET segment = 'HOT' WHERE id = $1", customer_id)
                return {"status": "success"}
        except Exception as e:
            print(f"Warning: Database error inserting handoff: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"status": "success"}

@app.get("/api/chat/poll/{customer_id}")
async def poll_chat(customer_id: str):
    return {"messages": conversations.get(customer_id, [])}

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
                           c.name, c.phone 
                    FROM handoffs h
                    JOIN customers c ON h.customer_id = c.id
                    ORDER BY h.created_at DESC
                """)
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"Warning: Database error fetching handoffs: {e}")
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
                else:
                    total_conversations = await conn.fetchval("SELECT COUNT(DISTINCT customer_id) FROM conversations")
                    warm_or_above = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment IN ('WARM', 'HOT', 'CUSTOMER')")
                    hot_or_above = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment IN ('HOT', 'CUSTOMER')")
                    orders_placed = await conn.fetchval("SELECT COUNT(id) FROM orders WHERE status = 'confirmed'")
                    avg_intent_score_val = await conn.fetchval("SELECT AVG(intent_score) FROM customers")

                conversion_rate = 0.0
                if total_conversations and total_conversations > 0:
                    conversion_rate = round((orders_placed / total_conversations) * 100, 1)
                
                avg_intent_score = round(avg_intent_score_val) if avg_intent_score_val else 0

                return {
                    "total_conversations": total_conversations or 0,
                    "warm_or_above": warm_or_above or 0,
                    "hot_or_above": hot_or_above or 0,
                    "orders_placed": orders_placed or 0,
                    "conversion_rate": conversion_rate,
                    "avg_intent_score": avg_intent_score
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
        "avg_intent_score": 0
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
                
            return {"status": "success", "business_id": business_id}
    except Exception as e:
        print(f"Error creating business: {e}")
        raise HTTPException(status_code=500, detail="Database error")

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
        print(f"Error adding catalog item: {e}")
        raise HTTPException(status_code=500, detail="Database error")

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

@app.get("/api/public/businesses")
async def get_public_businesses():
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT 
                b.slug, b.brand_name, b.language,
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
                "product_count": r["product_count"] or 0,
                "min_price": float(r['min_price'] or 0),
                "max_price": float(r['max_price'] or 0),
                "idx": idx
            })
            
        return stores
