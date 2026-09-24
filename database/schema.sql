-- Run this in Supabase (SQL Editor) or any PostgreSQL database
-- This creates the minimum tables described in Section 7 of the blueprint

CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand_name TEXT NOT NULL,
  language TEXT DEFAULT 'English + Hindi mix (Hinglish)',
  policies TEXT,
  dormant_after_days INT DEFAULT 30,  -- days of no orders before a CUSTOMER is marked DORMANT (per-business, §18)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE catalog_items (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  note TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES businesses(id),
  name TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  tier TEXT,
  source TEXT DEFAULT 'website',    -- e.g. 'website', 'referral', 'whatsapp'
  segment TEXT DEFAULT 'COLD',      -- COLD / WARM / HOT / CUSTOMER / REPEAT CUSTOMER / DORMANT
  intent_score INT DEFAULT 0,
  consent_whatsapp BOOLEAN DEFAULT FALSE,
  consent_email BOOLEAN DEFAULT FALSE,
  opted_out BOOLEAN DEFAULT FALSE,        -- §25/§26: true = stop ALL automated/promotional outreach
  follow_up_stage INT DEFAULT 0,          -- §17: which cadence touch this lead is currently at
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  wallet_balance NUMERIC DEFAULT 0,
  lifetime_value NUMERIC DEFAULT 0,
  preferred_channel TEXT DEFAULT 'chat',
  last_interaction TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  stock INT DEFAULT 0
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES businesses(id),
  customer_id INT REFERENCES customers(id),
  product_id INT REFERENCES catalog_items(id),
  status TEXT DEFAULT 'pending',    -- pending / confirmed / delivered / returned
  amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES businesses(id),
  customer_id INT REFERENCES customers(id),
  message TEXT,
  reply TEXT,
  intent_score INT,
  segment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- We no longer use products table or sample data here. Using catalog_items and python script instead.

CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  referred_customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  referred_order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  reward_status TEXT DEFAULT 'pending', -- pending / earned
  reward_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE handoffs (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  business_id INT REFERENCES businesses(id),
  reason TEXT,
  context_summary TEXT,      -- §32: what the customer wants / why escalated
  product_interest TEXT,     -- §32: product they were discussing
  objection TEXT,            -- §32: their hesitation, if any
  intent_score INT,          -- §32: score at time of handoff
  estimated_value NUMERIC,   -- §32: estimated deal value
  urgency TEXT,              -- §32: High / Medium / Low, derived from segment
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
