import os
import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import httpx
import asyncpg  # type: ignore
from contextlib import asynccontextmanager
import asyncio

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=env_path, override=True)

db_pool = None
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "openai/gpt-oss-120b"

async def abandoned_chat_worker():
    while True:
        await asyncio.sleep(30)
        if not db_pool or not GROQ_API_KEY:
            continue
            
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT id, ext_id, name, segment
                    FROM customers
                    WHERE segment IN ('WARM', 'HOT')
                      AND last_interaction < NOW() - INTERVAL '90 seconds'
                      AND (followed_up_at IS NULL OR followed_up_at < last_interaction)
                """)
                for row in rows:
                    customer_id = row['id']
                    ext_id = row['ext_id']
                    
                    try:
                        config = load_config()
                    except:
                        continue
                    
                    system_prompt = f"""You are an AI sales agent for {config.get('brandName')}.
Language: {config.get('language')}
The customer was interested (segment: {row['segment']}) but went silent.
Write a very short, natural follow-up message to re-engage them. 
Return ONLY raw JSON: {{"reply": "your message"}}
"""
                    messages = [{"role": "system", "content": system_prompt}]
                    
                    async with httpx.AsyncClient() as client:
                        try:
                            groq_response = await client.post(
                                "https://api.groq.com/openai/v1/chat/completions",
                                headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
                                json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 100, "temperature": 0.7},
                                timeout=10.0
                            )
                            data = groq_response.json()
                            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                            raw = re.sub(r'^```json', '', raw)
                            raw = re.sub(r'^```', '', raw)
                            raw = re.sub(r'```$', '', raw).strip()
                            parsed = json.loads(raw)
                            reply = parsed.get("reply", "Hi, are you still there? Let me know if you need help!")
                            
                            await conn.execute(
                                "INSERT INTO conversations (customer_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5)",
                                customer_id, None, reply, 0, row['segment']
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
            db_pool = await asyncpg.create_pool(db_url)
            async with db_pool.acquire() as conn:
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS ext_id TEXT UNIQUE;")
                await conn.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS followed_up_at TIMESTAMP;")
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS handoffs (
                        id SERIAL PRIMARY KEY,
                        customer_id INT REFERENCES customers(id),
                        reason TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                rows = await conn.fetch("""
                    SELECT c.ext_id, conv.message, conv.reply 
                    FROM conversations conv
                    JOIN customers c ON c.id = conv.customer_id
                    WHERE c.ext_id IS NOT NULL
                    ORDER BY conv.created_at ASC
                """)
                for row in rows:
                    ext_id = row['ext_id']
                    if ext_id not in conversations:
                        conversations[ext_id] = []
                    conversations[ext_id].append({"role": "user", "content": row['message']})
                    conversations[ext_id].append({"role": "assistant", "content": json.dumps({"reply": row['reply']})})
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

class ChatRequest(BaseModel):
    customerId: str
    message: str

class HandoffRequest(BaseModel):
    customerId: str
    reason: str

conversations = {}

def load_config():
    config_path = os.path.join(BASE_DIR, "business-config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

def detect_language(text: str) -> str:
    if re.search(r'[\u0A80-\u0AFF]', text):
        return 'Gujarati — reply ONLY in Gujarati script (ગુજરાતી)'
    if re.search(r'[\u0900-\u097F]', text):
        return 'Hindi — reply ONLY in Hindi (Devanagari) script'
    return 'English or Hinglish (Roman script) — if the customer mixed Hindi words in Roman letters, reply the same natural Hinglish way; if they wrote plain English, reply in plain English'

class ChatRequest(BaseModel):
    customerId: str
    message: str

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.customerId or not req.message:
        raise HTTPException(status_code=400, detail="customerId and message are required")

    config = load_config()
    catalog_text = "\n".join([
        f"{p['name']} — ₹{p['price']} — {p['note']}" 
        for p in config.get("catalog", [])
    ])

    if req.customerId not in conversations:
        conversations[req.customerId] = []
    
    history = conversations[req.customerId]
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
- Never invent prices, stock, delivery dates or offers not listed above.
- Be helpful, concise, human, persuasive without being pushy.
- Ask only necessary questions to narrow a recommendation.
- **NUMBER FORMATTING:** Do NOT use commas in prices or numbers in your 'reply' (e.g., write 1098, not 1,098 or 10,098).
- **UPSELL/CROSS-SELL:** When a customer shows intent to buy a main product (e.g., Jeans), suggest a related accessory (e.g., Belt, Jacket). HOWEVER, do not add the accessory to the final 'order_product' unless the customer explicitly says they want it. If they just say "confirm", only confirm the original item.
- **COUPON/DISCOUNT:** If the customer mentions the coupon code 'FIRST10', acknowledge it excitedly and apply a 10% discount to their purchase. When setting 'order_amount' in the JSON, calculate and provide the discounted price. Clearly mention the discount applied in your 'reply'.
- When the customer shows clear purchase intent (e.g., asking for delivery, confirming an order, or asking about sizes), naturally ask for their name and phone number (if not already provided). Do not ask upfront in the first message.
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
  "order_ready": boolean,
  "order_product": "product name being ordered or null",
  "order_amount": numeric price or null
}}"""

    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": req.message}]

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
                    "temperature": 0.7,
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
    raw = re.sub(r'^```json', '', raw)
    raw = re.sub(r'^```', '', raw)
    raw = re.sub(r'```$', '', raw).strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "reply": raw or "Sorry, thoda issue aa gaya. Please try again.",
            "intent_score": 0,
            "segment": "COLD",
            "reasoning": "Could not parse AI response",
            "objection": None,
            "recommended_product": None,
            "next_action": None,
            "customer_name": None,
            "customer_phone": None,
            "needs_human": False,
            "handoff_reason": None,
            "order_ready": False,
            "order_product": None,
            "order_amount": None,
        }

    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": json.dumps(parsed)})
    
    print(f"[{req.customerId}] score={parsed.get('intent_score')} segment={parsed.get('segment')}")

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
                        "INSERT INTO customers (ext_id, name, phone, segment, intent_score) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                        req.customerId, c_name, c_phone, parsed.get("segment", "COLD"), parsed.get("intent_score", 0)
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
                            followed_up_at = NULL
                        WHERE id = $3
                        """,
                        parsed.get("segment", "COLD"), 
                        parsed.get("intent_score", 0), 
                        customer_id,
                        c_name,
                        c_phone
                    )
                
                await conn.execute(
                    "INSERT INTO conversations (customer_id, message, reply, intent_score, segment) VALUES ($1, $2, $3, $4, $5)",
                    customer_id, req.message, parsed.get("reply", ""), parsed.get("intent_score", 0), parsed.get("segment", "COLD")
                )
                
                if parsed.get("needs_human"):
                    await conn.execute(
                        "INSERT INTO handoffs (customer_id, reason) VALUES ($1, $2)",
                        customer_id, parsed.get("handoff_reason", "Customer requested human assistance")
                    )
                
                if parsed.get("order_ready"):
                    import random
                    order_id = f"ORD-{random.randint(10000, 99999)}"
                    prod_name = parsed.get("order_product")
                    prod_id = None
                    if prod_name:
                        prod_id = await conn.fetchval("SELECT id FROM products WHERE name ILIKE $1 LIMIT 1", f"%{prod_name}%")
                    
                    await conn.execute(
                        "INSERT INTO orders (customer_id, product_id, status, amount) VALUES ($1, $2, $3, $4)",
                        customer_id, prod_id, 'confirmed', parsed.get("order_amount")
                    )
                    parsed["order_id"] = order_id
        except Exception as e:
            print(f"Warning: Database error during chat save: {e}")

    return parsed

@app.get("/api/config")
def get_config():
    try:
        return load_config()
    except Exception:
        raise HTTPException(status_code=500, detail="Could not load business config")

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/customers")
async def get_customers():
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT id, ext_id, name, phone, segment, intent_score, last_interaction 
                    FROM customers 
                    ORDER BY last_interaction DESC NULLS LAST
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
                    LEFT JOIN products p ON o.product_id = p.id
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

@app.get("/api/handoffs")
async def get_handoffs():
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
async def resolve_handoff(handoff_id: int):
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("UPDATE handoffs SET status = 'resolved' WHERE id = $1", handoff_id)
                return {"status": "success"}
        except Exception as e:
            print(f"Warning: Database error resolving handoff: {e}")
            raise HTTPException(status_code=500, detail="Database error")
    return {"status": "success"}

@app.get("/api/analytics")
async def get_analytics():
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                total_conversations = await conn.fetchval("SELECT COUNT(DISTINCT customer_id) FROM conversations")
                warm_or_above = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment IN ('WARM', 'HOT', 'CUSTOMER')")
                hot_or_above = await conn.fetchval("SELECT COUNT(id) FROM customers WHERE segment IN ('HOT', 'CUSTOMER')")
                orders_placed = await conn.fetchval("SELECT COUNT(id) FROM orders WHERE status = 'confirmed'")
                
                conversion_rate = 0.0
                if total_conversations and total_conversations > 0:
                    conversion_rate = round((orders_placed / total_conversations) * 100, 1)
                
                avg_intent_score_val = await conn.fetchval("SELECT AVG(intent_score) FROM customers")
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


