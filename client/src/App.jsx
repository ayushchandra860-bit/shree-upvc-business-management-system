import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import Products from './pages/Products.jsx';
import Quotations from './pages/Quotations.jsx';
import Orders from './pages/Orders.jsx';
import Invoices from './pages/Invoices.jsx';
import Payments from './pages/Payments.jsx';
import Employees from './pages/Employees.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Expenses from './pages/Expenses.jsx';
import Reports from './pages/Reports.jsx';
import SettingsPage from './pages/Settings.jsx';
import BackupRestore from './pages/BackupRestore.jsx';
import Security from './pages/Security.jsx';

const pages = {
  dashboard: Dashboard,
  customers: Customers,
  products: Products,
  quotations: Quotations,
  orders: Orders,
  invoices: Invoices,
  payments: Payments,
  employees: Employees,
  suppliers: Suppliers,
  expenses: Expenses,
  reports: Reports,
  settings: SettingsPage,
  backup: BackupRestore,
  security: Security
};

function currentHashPage() {
  return window.location.hash.replace('#/', '') || 'dashboard';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPageState] = useState(currentHashPage());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const onHash = () => setPageState(currentHashPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setPage = (nextPage) => {
    window.location.hash = `#/${nextPage}`;
    setPageState(nextPage);
  };

  const ActivePage = useMemo(() => pages[page] || Dashboard, [page]);

  async function handleLogout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPage('dashboard');
  }

  if (checking) {
    return <div className="loadingScreen">Loading SHREE UPVC WINDOWS & DOORS</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Layout page={page} setPage={setPage} user={user} onLogout={handleLogout}>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>Close</button>
        </div>
      )}
      <ActivePage setNotice={setNotice} />
    </Layout>
  );
}
