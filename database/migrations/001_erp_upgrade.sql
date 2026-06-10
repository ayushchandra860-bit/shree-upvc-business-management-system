CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS manufacturing_charges numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_conditions text NOT NULL DEFAULT 'Payment as agreed. Final measurements and site conditions are subject to verification before manufacturing.',
  ADD COLUMN IF NOT EXISTS pdf_notes text NOT NULL DEFAULT '';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS transportation_charges numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installation_charges numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manufacturing_charges numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_conditions text NOT NULL DEFAULT 'Goods once supplied as per approved quotation will be handled as per company terms.',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Unpaid',
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) NOT NULL DEFAULT 0;

UPDATE invoices
SET remaining_amount = final_amount,
    paid_amount = 0,
    payment_status = 'Unpaid'
WHERE paid_amount = 0 AND remaining_amount = 0;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Admin';

ALTER TABLE report_snapshots DROP CONSTRAINT IF EXISTS report_snapshots_report_type_check;
ALTER TABLE report_snapshots
  ADD CONSTRAINT report_snapshots_report_type_check
  CHECK (report_type IN (
    'daily_sales',
    'monthly_sales',
    'customer_wise',
    'employee',
    'expense',
    'revenue',
    'profit_loss'
  ));

CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL;

INSERT INTO product_categories (category_name, description)
VALUES
  ('Window', 'UPVC window products'),
  ('Door', 'UPVC door products'),
  ('Glass', 'Glass and glazing items'),
  ('Hardware', 'Handles, locks, rollers, and accessories')
ON CONFLICT (category_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS company_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  company_name text NOT NULL DEFAULT 'SHREE UPVC WINDOWS & DOORS',
  logo_url text NOT NULL DEFAULT '',
  gst_number text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT 'Baba Market, Lekha Nagar, Danapur, Patna - 801105, Bihar',
  mobile_number text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  bank_details text NOT NULL DEFAULT '',
  qr_code_url text NOT NULL DEFAULT '',
  terms_conditions text NOT NULL DEFAULT 'Payment as agreed. Warranty and service terms are subject to final quotation and invoice.',
  authorized_signature text NOT NULL DEFAULT 'Authorized Signatory',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO company_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS signature_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ifsc text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS upi_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#0b2d5c',
  ADD COLUMN IF NOT EXISTS sidebar_color text NOT NULL DEFAULT '#0b2d5c';

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL DEFAULT 'Cash',
  reference_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON payments(customer_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_date_idx ON payments(payment_date);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile text NOT NULL,
  address text NOT NULL DEFAULT '',
  aadhaar text NOT NULL DEFAULT '',
  joining_date date NOT NULL DEFAULT current_date,
  designation text NOT NULL DEFAULT '',
  salary_type text NOT NULL DEFAULT 'Monthly'
    CHECK (salary_type IN ('Monthly', 'Daily', 'Hourly', 'Target Based', 'Commission Based')),
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT current_date,
  status text NOT NULL CHECK (status IN ('Present', 'Absent', 'Half Day', 'Leave')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  advance_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  deducted_amount numeric(12,2) NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  salary_month text NOT NULL,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  advance_deduction numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending')),
  paid_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, salary_month)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  mobile text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  gst_number text NOT NULL DEFAULT '',
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_type text NOT NULL DEFAULT 'Payment' CHECK (payment_type IN ('Payment', 'Advance')),
  payment_mode text NOT NULL DEFAULT 'Cash',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  category text NOT NULL CHECK (category IN (
    'Material Purchase',
    'Glass Purchase',
    'Hardware Purchase',
    'Salary Expenses',
    'Transportation',
    'Electricity',
    'Rent',
    'Misc Expenses'
  )),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_to text NOT NULL DEFAULT '',
  payment_mode text NOT NULL DEFAULT 'Cash',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  email text NOT NULL,
  success boolean NOT NULL,
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'Manual',
  export_format text NOT NULL DEFAULT 'JSON',
  status text NOT NULL DEFAULT 'Completed',
  file_name text NOT NULL DEFAULT '',
  included_tables text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO number_sequences (sequence_type, prefix, current_value)
VALUES
  ('payment', 'RCT', 0),
  ('employee', 'EMP', 0)
ON CONFLICT (sequence_type) DO NOTHING;
