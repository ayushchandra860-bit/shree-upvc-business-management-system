CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique_idx
  ON admin_users (lower(email));

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  mobile_number text NOT NULL,
  site_address text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_search_idx
  ON customers USING gin (
    to_tsvector('simple', customer_name || ' ' || mobile_number || ' ' || site_address)
  );

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Window', 'Door')),
  rate_per_sqft numeric(12,2) NOT NULL CHECK (rate_per_sqft >= 0),
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_name, category)
);

CREATE TABLE IF NOT EXISTS number_sequences (
  sequence_type text PRIMARY KEY,
  prefix text NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO number_sequences (sequence_type, prefix, current_value)
VALUES
  ('quotation', 'QTN', 0),
  ('invoice', 'INV', 0),
  ('order', 'ORD', 0)
ON CONFLICT (sequence_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  quotation_date date NOT NULL DEFAULT current_date,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  mobile_number text NOT NULL,
  site_address text NOT NULL,
  transportation_charges numeric(12,2) NOT NULL DEFAULT 0,
  installation_charges numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Quotation Created'
    CHECK (status IN (
      'Quotation Created',
      'Order Confirmed',
      'Manufacturing',
      'Installation Scheduled',
      'Installation Completed'
    )),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotations_customer_id_idx ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS quotations_date_idx ON quotations(quotation_date);

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_type text NOT NULL,
  width_mm numeric(12,2) NOT NULL CHECK (width_mm > 0),
  height_mm numeric(12,2) NOT NULL CHECK (height_mm > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  area_sqft numeric(12,3) NOT NULL,
  total_sqft numeric(12,3) NOT NULL,
  rate_per_sqft numeric(12,2) NOT NULL,
  product_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  quotation_id uuid UNIQUE REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Order Confirmed'
    CHECK (status IN (
      'Quotation Created',
      'Order Confirmed',
      'Manufacturing',
      'Installation Scheduled',
      'Installation Completed'
    )),
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  confirmed_date date NOT NULL DEFAULT current_date,
  scheduled_installation_date date,
  completed_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text NOT NULL DEFAULT '',
  changed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL DEFAULT current_date,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  mobile_number text NOT NULL,
  site_address text NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  final_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_date_idx ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices(customer_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_type text NOT NULL,
  width_mm numeric(12,2) NOT NULL,
  height_mm numeric(12,2) NOT NULL,
  quantity integer NOT NULL,
  total_sqft numeric(12,3) NOT NULL,
  rate_per_sqft numeric(12,2) NOT NULL,
  product_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN (
    'daily_sales',
    'monthly_sales',
    'customer_wise',
    'revenue'
  )),
  period_start date,
  period_end date,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON "session" (expire);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_users_set_updated_at ON admin_users;
CREATE TRIGGER admin_users_set_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS quotations_set_updated_at ON quotations;
CREATE TRIGGER quotations_set_updated_at
BEFORE UPDATE ON quotations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS invoices_set_updated_at ON invoices;
CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO products (product_name, category, rate_per_sqft, description)
VALUES
  ('Sliding Window', 'Window', 650.00, 'Durable UPVC sliding window system with smooth rollers and weather sealing.'),
  ('Casement Window', 'Window', 720.00, 'Premium UPVC casement window with multi-point locking and tight insulation.'),
  ('Fixed Window', 'Window', 520.00, 'Fixed UPVC window for natural light, visibility, and low maintenance.'),
  ('Combination Window', 'Window', 780.00, 'Combination UPVC window system configured for mixed fixed and openable panels.'),
  ('Sliding Door', 'Door', 850.00, 'Strong UPVC sliding door system for balconies, patios, and wide openings.'),
  ('Casement Door', 'Door', 900.00, 'UPVC casement door with secure hardware and clean finishing.'),
  ('French Door', 'Door', 1050.00, 'Elegant UPVC French door with double shutter opening and premium appearance.'),
  ('Folding Door', 'Door', 1150.00, 'Space-efficient UPVC folding door system for larger openings.')
ON CONFLICT (product_name, category) DO UPDATE
SET
  rate_per_sqft = EXCLUDED.rate_per_sqft,
  description = EXCLUDED.description,
  active = true;
