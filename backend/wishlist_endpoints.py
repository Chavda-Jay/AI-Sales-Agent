class WishlistReq(BaseModel):
    customerId: str
    catalogItemId: int

@app.post("/api/wishlist")
async def add_wishlist(req: WishlistReq):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    try:
        async with db_pool.acquire() as conn:
            cust = await conn.fetchrow("SELECT id, business_id FROM customers WHERE ext_id = $1", req.customerId)
            if not cust:
                raise HTTPException(status_code=404, detail="Customer not found")
            try:
                await conn.execute(
                    "INSERT INTO wishlist_items (customer_id, catalog_item_id, business_id) VALUES ($1, $2, $3)",
                    cust['id'], req.catalogItemId, cust['business_id']
                )
            except Exception: # Ignore unique violation
                pass
        return {"status": "success"}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Database error")

@app.delete("/api/wishlist/{catalog_item_id}")
async def remove_wishlist(catalog_item_id: int, customerId: str):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    try:
        async with db_pool.acquire() as conn:
            cust = await conn.fetchrow("SELECT id FROM customers WHERE ext_id = $1", customerId)
            if cust:
                await conn.execute(
                    "DELETE FROM wishlist_items WHERE customer_id = $1 AND catalog_item_id = $2",
                    cust['id'], catalog_item_id
                )
        return {"status": "success"}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Database error")

@app.get("/api/wishlist/{customer_id}")
async def get_wishlist(customer_id: str):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    try:
        async with db_pool.acquire() as conn:
            cust = await conn.fetchrow("SELECT id FROM customers WHERE ext_id = $1", customer_id)
            if not cust:
                return []
            items = await conn.fetch(
                "SELECT ci.* FROM wishlist_items wi JOIN catalog_items ci ON ci.id = wi.catalog_item_id WHERE wi.customer_id = $1 ORDER BY wi.created_at DESC",
                cust['id']
            )
            return [dict(i) for i in items]
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Database error")
