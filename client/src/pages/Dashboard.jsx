import { useEffect, useState } from 'react';
import { ClipboardList, CreditCard, IndianRupee, PackageCheck, ReceiptText, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { api, formatDate, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const cards = [
  ['totalCustomers', 'Total Customers', Users],
  ['totalQuotations', 'Total Quotations', ClipboardList],
  ['totalOrders', 'Total Orders', ReceiptText],
  ['totalInvoices', 'Total Invoices', ReceiptText],
  ['pendingInstallations', 'Pending Installations', PackageCheck],
  ['monthlyRevenue', 'Monthly Revenue', IndianRupee],
  ['pendingPayments', 'Pending Payments', CreditCard],
  ['pendingSalaries', 'Pending Salaries', TrendingDown],
  ['totalExpenses', 'Total Expenses', TrendingDown],
  ['netProfit', 'Net Profit', TrendingUp]
];

const emptyDashboard = {
  stats: {
    totalCustomers: 0,
    totalQuotations: 0,
    totalOrders: 0,
    totalInvoices: 0,
    pendingInstallations: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    pendingSalaries: 0,
    totalExpenses: 0,
    netProfit: 0
  },
  recentQuotations: [],
  recentOrders: [],
  recentActivity: []
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/dashboard')
      .then((result) => setData({
        ...emptyDashboard,
        ...result,
        stats: { ...emptyDashboard.stats, ...(result.stats || {}) }
      }))
      .catch(() => setData(emptyDashboard))
      .finally(() => setLoading(false));
  }, []);

if (loading) return <div className="panel">Loading dashboard</div>;

if (!data || !data.stats) {
  return (
    <div className="panel">
      Dashboard data not available
    </div>
  );
}

  return (
    <div className="pageStack">
      <section className="statsGrid">
        {cards.map(([key, label, Icon]) => (
          <article className="statCard" key={key}>
            <div className="statIcon"><Icon size={20} /></div>
            <span>{label}</span>
            <strong>{['monthlyRevenue', 'pendingPayments', 'pendingSalaries', 'totalExpenses', 'netProfit'].includes(key) ? formatMoney(data.stats[key]) : data.stats[key]}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <h2>Recent Quotations</h2>
        </div>
        {(data.recentQuotations || []).length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Quotation No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th className="amountCell">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentQuotations.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.quotation_number}</td>
                    <td>{formatDate(quote.quotation_date)}</td>
                    <td>{quote.customer_name}</td>
                    <td>{quote.mobile_number}</td>
                    <td><StatusBadge status={quote.status} /></td>
                    <td className="amountCell">{formatMoney(quote.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No quotations yet" />
        )}
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <h2>Recent Orders</h2>
        </div>
        {(data.recentOrders || []).length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Quotation</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="amountCell">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>{order.quotation_number || '-'}</td>
                    <td>{order.customer_name || '-'}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="amountCell">{formatMoney(order.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No orders yet" />
        )}
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <h2>Recent Activity</h2>
        </div>
        {(data.recentActivity || []).length ? (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Date</th><th>Action</th><th>Module</th></tr></thead>
              <tbody>
                {data.recentActivity.map((activity, index) => (
                  <tr key={`${activity.created_at}-${index}`}>
                    <td>{formatDate(activity.created_at)}</td>
                    <td>{activity.action}</td>
                    <td>{activity.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No recent activity" />
        )}
      </section>
    </div>
  );
}
