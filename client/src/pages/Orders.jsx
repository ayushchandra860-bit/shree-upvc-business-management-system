import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api, formatDate, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const statuses = [
  'Quotation Created',
  'Order Confirmed',
  'Manufacturing',
  'Installation Scheduled',
  'Installation Completed'
];

export default function Orders({ setNotice }) {
  const [orders, setOrders] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [orderForm, setOrderForm] = useState({ quotation_id: '', status: 'Order Confirmed', scheduled_installation_date: '', notes: '' });

  async function loadOrders() {
    const [data, quoteData] = await Promise.all([api('/api/orders'), api('/api/quotations')]);
    setOrders(data.orders);
    setQuotations(quoteData.quotations);
    setDrafts(Object.fromEntries(data.orders.map((order) => [order.id, {
      status: order.status,
      scheduled_installation_date: order.scheduled_installation_date?.slice(0, 10) || '',
      completed_date: order.completed_date?.slice(0, 10) || '',
      notes: order.notes || ''
    }])));
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function saveStatus(orderId) {
    await api(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(drafts[orderId])
    });
    setNotice('Order status updated');
    await loadOrders();
  }

  function patchDraft(orderId, patch) {
    setDrafts({ ...drafts, [orderId]: { ...drafts[orderId], ...patch } });
  }

  async function createOrder(event) {
    event.preventDefault();
    await api('/api/orders', { method: 'POST', body: JSON.stringify(orderForm) });
    setOrderForm({ quotation_id: '', status: 'Order Confirmed', scheduled_installation_date: '', notes: '' });
    setNotice('Order created');
    await loadOrders();
  }

  async function deleteOrder(orderId) {
    await api(`/api/orders/${orderId}`, { method: 'DELETE' });
    setNotice('Order deleted');
    await loadOrders();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader">
          <h2>Create Order</h2>
        </div>
        <form className="formGrid fourCols" onSubmit={createOrder}>
          <label className="spanTwo">
            Quotation
            <select value={orderForm.quotation_id} onChange={(event) => setOrderForm({ ...orderForm, quotation_id: event.target.value })} required>
              <option value="">Select quotation</option>
              {quotations.map((quote) => (
                <option key={quote.id} value={quote.id}>{quote.quotation_number} - {quote.customer_name} - {formatMoney(quote.grand_total)}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={orderForm.status} onChange={(event) => setOrderForm({ ...orderForm, status: event.target.value })}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Installation Date
            <input type="date" value={orderForm.scheduled_installation_date} onChange={(event) => setOrderForm({ ...orderForm, scheduled_installation_date: event.target.value })} />
          </label>
          <button className="primaryButton" type="submit"><Plus size={18} />Create Order</button>
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <h2>Order Management</h2>
        </div>
      {orders.length ? (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Quotation</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Installation Date</th>
                <th className="amountCell">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>{order.quotation_number}</td>
                  <td>
                    <strong>{order.customer_name}</strong>
                    <span className="subText">{order.mobile_number}</span>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                    <select value={drafts[order.id]?.status || order.status} onChange={(event) => patchDraft(order.id, { status: event.target.value })}>
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={drafts[order.id]?.scheduled_installation_date || ''}
                      onChange={(event) => patchDraft(order.id, { scheduled_installation_date: event.target.value })}
                    />
                    <span className="subText">Confirmed {formatDate(order.confirmed_date)}</span>
                  </td>
                  <td className="amountCell">{formatMoney(order.total_amount)}</td>
                  <td>
                    <div className="tableActions">
                      <button className="iconButton small" title="Save status" type="button" onClick={() => saveStatus(order.id)}>
                        <Save size={16} />
                      </button>
                      <button className="iconButton small" title="Delete order" type="button" onClick={() => deleteOrder(order.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No orders found" />
      )}
      </section>
    </div>
  );
}
