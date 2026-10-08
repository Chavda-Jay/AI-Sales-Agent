import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

new_code = """
def compute_priority_score(customer_row, business_ctx, now=None):
    import json
    sb = customer_row.get('score_breakdown')
    if isinstance(sb, str):
        try: sb = json.loads(sb)
        except: sb = {}
    elif sb is None:
        sb = {}
        
    if 'purchase_intent' in sb and sb['purchase_intent'] is not None:
        pi = float(sb['purchase_intent']) / 30.0
    else:
        pi = float(customer_row.get('intent_score') or 0) / 100.0
    pi = max(pi, 0.05)
    
    if 'customer_fit' in sb and sb['customer_fit'] is not None:
        cf = float(sb['customer_fit']) / 10.0
    else:
        cf = 0.5
    cf = max(cf, 0.05)
    
    er = float(customer_row.get('avg_order_amount') or 0)
    if er == 0:
        if business_ctx and 'avg_order_value' in business_ctx:
            er = float(business_ctx['avg_order_value'])
        if er == 0:
            er = float(customer_row.get('avg_catalog_price') or 0)
    er = max(er, 0.05)
    
    band = customer_row.get('score_band')
    if band == 'HOT': p = 0.8
    elif band == 'HIGH': p = 0.6
    elif band == 'MEDIUM': p = 0.4
    elif band == 'LOW': p = 0.2
    elif band == 'VERY LOW': p = 0.1
    else: p = 0.2
    p = max(p, 0.05)
    
    hours = customer_row.get('hours_since_interaction')
    has_pending = customer_row.get('pending_handoffs') or 0
    if has_pending > 0 or (hours is not None and hours <= 1):
        u = 1.0
    elif hours is not None and hours <= 24:
        u = 0.7
    elif hours is not None and hours <= 72:
        u = 0.4
    else:
        u = 0.2
    u = max(u, 0.05)
    
    score = round(pi * cf * er * p * u, 2)
    return score, {
        "purchase_intent": round(pi, 2),
        "customer_fit": round(cf, 2),
        "expected_revenue": round(er, 2),
        "probability": round(p, 2),
        "urgency": round(u, 2)
    }

@app.get("/api/priority-queue")
async def get_priority_queue(shop: str, limit: int = 10, _ = Depends(verify_admin)):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(\"\"\"
            SELECT 
                c.id, c.name, c.segment, c.intent_score, c.score_band, 
                c.score_breakdown, c.follow_up_stage, c.opted_out,
                EXTRACT(EPOCH FROM (NOW() - c.last_interaction))/3600 AS hours_since_interaction,
                (SELECT COUNT(*) FROM handoffs h WHERE h.customer_id = c.id AND h.status = 'pending') AS pending_handoffs,
                (SELECT AVG(amount) FROM orders WHERE customer_id = c.id AND status = 'confirmed') AS avg_order_amount,
                (SELECT AVG(price) FROM catalog_items WHERE business_id = b.id) AS avg_catalog_price,
                b.business_context
            FROM customers c
            JOIN businesses b ON c.business_id = b.id
            WHERE b.slug = $1 
              AND c.segment IN ('COLD', 'WARM', 'HOT')
              AND c.opted_out = FALSE
        \"\"\", shop)
        
        results = []
        for r in rows:
            b_ctx = r.get('business_context')
            if isinstance(b_ctx, str):
                import json
                try: b_ctx = json.loads(b_ctx)
                except: b_ctx = {}
            elif b_ctx is None:
                b_ctx = {}
                
            score, factors = compute_priority_score(r, b_ctx)
            action = get_next_action(r.get('segment'), r.get('follow_up_stage'), r.get('opted_out'))
            
            results.append({
                "customer_id": r['id'],
                "name": r['name'] or "Anonymous",
                "segment": r['segment'],
                "intent_score": r['intent_score'],
                "score_band": r['score_band'],
                "priority_score": score,
                "factors": factors,
                "next_action": action
            })
            
        results.sort(key=lambda x: x["priority_score"], reverse=True)
        return {"opportunities": results[:limit]}
"""

target = '@app.get("/api/customers/{customer_id}/profile")'
if target in content:
    content = content.replace(target, new_code + "\n" + target)
    with open("main.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully.")
else:
    print("Target not found.")
