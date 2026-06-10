# SHREE UPVC WINDOWS & DOORS Business Management System

Production-ready business management system for:

**SHREE UPVC WINDOWS & DOORS**  
Baba Market, Lekha Nagar,  
Danapur, Patna - 801105, Bihar

Business type: UPVC Windows & Doors Manufacturing, Supply and Installation.

## Features

- Secure admin login with server-side sessions
- Admin dashboard
- Customer management and customer history
- Product management for UPVC window and door types
- Professional quotation generation with automatic numbering
- Server-side square feet, GST, discount, transportation, installation, and grand total calculation
- Order tracking from quotation to installation completion
- Professional PDF invoice generation with download and print actions
- Daily sales, monthly sales, customer-wise, and revenue reports
- Payment management with partial payments, receipts, and invoice payment status
- Employee profiles, attendance, salary calculation, and advance ledger
- Supplier payments, supplier advances, pending supplier balances
- Expense tracking for material, glass, hardware, salary, transportation, electricity, rent, and miscellaneous expenses
- Company settings for GST number, mobile, email, logo URL, QR code URL, bank details, and terms
- Backup and restore exports in JSON, ZIP, and Excel-compatible formats
- Admin security: create admin, change password, deactivate admin, audit logs, and login history
- Supabase PostgreSQL persistence for customers, products, quotations, invoices, orders, reports, and sessions
- Render-ready deployment configuration

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: Supabase PostgreSQL
- PDF: PDFKit
- Authentication: Express session + bcrypt password hashes

## Project Structure

```text
.
├── client/                 React frontend
├── database/schema.sql     Supabase PostgreSQL schema and default products
├── server/                 Express backend
├── .env.example            Environment variable template
├── package.json            Workspace scripts
└── render.yaml             Render deployment config
```

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the complete SQL file at `database/schema.sql`.
4. Run the ERP migration at `database/migrations/001_erp_upgrade.sql`.
5. Copy the Supabase PostgreSQL connection string.
6. Create a `.env` file from `.env.example`.
7. Set `SUPABASE_DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

For an existing deployment, run only `database/migrations/001_erp_upgrade.sql`. It uses additive table creation and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so existing business data is preserved.

Use the Supabase transaction pooler connection string for Render when possible.

## Local Development

```bash
npm install
npm run seed:admin
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:10000`

## Production Build

```bash
npm install
npm run build
npm run start
```

The Express server serves the built React app in production.

## Render Deployment

1. Push this project to a Git repository.
2. Create a Render Web Service from the repository.
3. Render can use `render.yaml`, or set these commands manually:

```bash
Build Command: npm install && npm run build
Start Command: npm run start
```

4. Add environment variables in Render:

```text
NODE_ENV=production
SESSION_SECRET=your-long-random-secret
SUPABASE_DATABASE_URL=your-supabase-postgresql-url
DB_SSL=true
```

5. Run the admin seed once after deployment:

```bash
npm run seed:admin
```

Set these temporary variables before seeding:

```text
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@shreeupvc.com
ADMIN_PASSWORD=ChangeThisStrongPassword123
```

Change the password after the first setup by running the seed command again with a new `ADMIN_PASSWORD`.

## Business Data Safety

No business data is stored in SQLite, JSON files, or browser local storage. Customer, quotation, invoice, order, product, report, and session data are stored permanently in Supabase PostgreSQL.

## ERP Upgrade Modules

The upgraded ERP includes:

- Customers: add, edit, delete, search, history, and payment history
- Products: add, edit, deactivate/delete, active/inactive status, and categories
- Quotations: manufacturing charges, notes, terms, GST, transportation, installation, discount, and server-side totals
- Invoices: GST number, company settings, payment status, paid watermark, signatures, QR payment section, and bank details
- Payments: add, edit, delete, partial payments, remaining balance, and printable receipts
- Employees: profile, salary type, attendance, salary calculation, and advance ledger
- Suppliers: supplier list, payments, advances, and pending balance
- Expenses: all requested expense categories
- Reports: sales, customer, employee, expense, revenue, and profit/loss
- Backup & Restore: full business export and restore with backup history
- Security: admin management, password changes, audit logs, and login history
