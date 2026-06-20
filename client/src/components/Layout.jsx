import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  DatabaseBackup,
  FileText,
  Home,
  LogOut,
  PackageCheck,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Boxes },
  { id: 'quotations', label: 'Quotations', icon: FileText },
  { id: 'orders', label: 'Orders', icon: PackageCheck },
  { id: 'invoices', label: 'Invoices', icon: ReceiptText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'employees', label: 'Employees', icon: UserRoundCog },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'expenses', label: 'Expenses', icon: ClipboardList },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'backup', label: 'Backup', icon: DatabaseBackup },
  { id: 'security', label: 'Security', icon: ShieldCheck }
];

const pageMeta = {
  dashboard: 'Business overview with revenue, activity and recent operational movement.',
  customers: 'Manage customer records, project addresses and their document history in one place.',
  products: 'Maintain the active product catalogue and rate cards used across quotations and invoices.',
  quotations: 'Prepare polished customer-ready quotations with measurement, pricing and approval details.',
  orders: 'Track confirmed work from production through installation completion.',
  invoices: 'Issue professional tax invoices with clearer payment visibility and faster customer handoff.',
  payments: 'Monitor collections, partial receipts and outstanding balances without losing the audit trail.',
  employees: 'Manage employee details, attendance-linked data and payroll references.',
  suppliers: 'Track supplier profiles, commercial balances and payment movement.',
  expenses: 'Capture operating costs and keep profitability reporting grounded in actual spend.',
  reports: 'Review business performance with sales, customer, payment and operational reporting.',
  settings: 'Update company identity, document preferences and invoice presentation controls.',
  backup: 'Protect business records with export and restore tools for admin use.',
  security: 'Control access, password changes, admin activity and login history.'
};

export default function Layout({ page, setPage, user, onLogout, children }) {
  const currentPage = navItems.find((item) => item.id === page);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">SU</div>
          <div>
            <strong>SHREE UPVC</strong>
            <span>WINDOWS & DOORS</span>
          </div>
        </div>
        <nav className="navList" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`navItem ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
                type="button"
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebarFooter">
          <strong>Manufacturing | Supply | Installation</strong>
          <span>Built for day-to-day commercial, fabrication and billing work.</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Baba Market, Lekha Nagar, Danapur, Patna - 801105, Bihar</p>
            <h1>{currentPage?.label || 'Dashboard'}</h1>
            <p className="pageSubtitle">{pageMeta[page] || pageMeta.dashboard}</p>
          </div>
          <div className="adminBox">
            <span>{user?.name || 'Admin'}</span>
            <button className="iconButton" onClick={onLogout} type="button" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
