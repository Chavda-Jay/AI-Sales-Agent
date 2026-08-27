-- Run this in Supabase (SQL Editor) or any PostgreSQL database
-- This creates the minimum tables described in Section 7 of the blueprint

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT,
  city TEXT,
  source TEXT,                      -- e.g. 'website', 'whatsapp', 'instagram'
  segment TEXT DEFAULT 'COLD',      -- COLD / WARM / HOT / CUSTOMER / DORMANT
  intent_score INT DEFAULT 0,
  consent_whatsapp BOOLEAN DEFAULT FALSE,
  consent_email BOOLEAN DEFAULT FALSE,
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
  customer_id INT REFERENCES customers(id),
  product_id INT REFERENCES products(id),
  status TEXT DEFAULT 'pending',    -- pending / confirmed / delivered / returned
  amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  message TEXT,
  reply TEXT,
  intent_score INT,
  segment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sample data for the clothing store example
INSERT INTO products (name, price, description, stock) VALUES
('Men''s Cotton T-Shirt', 599, 'Soft everyday wear, 5 colors', 100),
('Slim Fit Jeans', 1299, 'Stretch denim, all sizes', 60),
('Casual Sneakers', 1999, 'Lightweight, all-day comfort', 40),
('Formal Shirt', 899, 'Office wear, wrinkle-free', 80);
