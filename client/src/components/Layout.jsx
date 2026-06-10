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

export default function Layout({ page, setPage, user, onLogout, children }) {
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
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Baba Market, Lekha Nagar, Danapur, Patna - 801105, Bihar</p>
            <h1>{navItems.find((item) => item.id === page)?.label || 'Dashboard'}</h1>
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
