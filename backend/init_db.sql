-- backend/init_db.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'sales',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL UNIQUE,
  interested_product VARCHAR(255),
  budget VARCHAR(100),
  status VARCHAR(50) DEFAULT 'New',
  source VARCHAR(50) DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  sender VARCHAR(50) NOT NULL, -- 'bot', 'sales', 'customer'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  brand VARCHAR(255) NOT NULL, -- Name / Brand
  price NUMERIC(15, 2) NOT NULL,
  category VARCHAR(100),
  stock INT DEFAULT 1,
  description TEXT,
  image_url VARCHAR(255),
  purchase_price NUMERIC(15, 2) DEFAULT 0, -- Unit Cost
  transport_cost NUMERIC(15, 2) DEFAULT 0, -- Shipping
  repair_cost NUMERIC(15, 2) DEFAULT 0,    -- Additional processing
  registration_fee NUMERIC(15, 2) DEFAULT 0, -- Service fee / tax
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_sales (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  selling_price NUMERIC(15, 2) NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'Bank',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_flow (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL, -- 'Income' or 'Expense'
  account VARCHAR(50) NOT NULL, -- 'Cash' or 'Bank'
  amount NUMERIC(15, 2) NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

