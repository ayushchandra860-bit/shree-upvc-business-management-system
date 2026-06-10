import { useEffect, useState } from 'react';
import { History, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { api, formatDate, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const blankCustomer = {
  customer_name: '',
  mobile_number: '',
  site_address: '',
  notes: ''
};

export default function Customers({ setNotice }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankCustomer);
  const [editingId, setEditingId] = useState('');
  const [history, setHistory] = useState(null);

  async function loadCustomers(query = search) {
    const data = await api(`/api/customers${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    setCustomers(data.customers);
  }

  useEffect(() => {
    loadCustomers('');
  }, []);

  async function submit(event) {
    event.preventDefault();
    const path = editingId ? `/api/customers/${editingId}` : '/api/customers';
    const method = editingId ? 'PUT' : 'POST';
    await api(path, { method, body: JSON.stringify(form) });
    setForm(blankCustomer);
    setEditingId('');
    setNotice(editingId ? 'Customer updated' : 'Customer added');
    await loadCustomers();
  }

  function editCustomer(customer) {
    setEditingId(customer.id);
    setForm({
      customer_name: customer.customer_name,
      mobile_number: customer.mobile_number,
      site_address: customer.site_address,
      notes: customer.notes || ''
    });
  }

  async function openHistory(customerId) {
    const data = await api(`/api/customers/${customerId}/history`);
    setHistory(data);
  }

  async function deleteCustomer(customerId) {
    await api(`/api/customers/${customerId}`, { method: 'DELETE' });
    setNotice('Customer deleted');
    await loadCustomers();
  }

  return (
    <div className="pageGrid">
      <section className="panel">
        <div className="sectionHeader">
          <h2>{editingId ? 'Update Customer' : 'Add Customer'}</h2>
        </div>
        <form className="formGrid" onSubmit={submit}>
          <label>
            Customer Name
            <input value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} required />
          </label>
          <label>
            Mobile Number
            <input value={form.mobile_number} onChange={(event) => setForm({ ...form, mobile_number: event.target.value })} required />
          </label>
          <label className="spanTwo">
            Site Address
            <textarea value={form.site_address} onChange={(event) => setForm({ ...form, site_address: event.target.value })} required />
          </label>
          <label className="spanTwo">
            Notes
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <div className="buttonRow">
            <button className="primaryButton" type="submit">
              {editingId ? <Save size={18} /> : <Plus size={18} />}
              {editingId ? 'Save Customer' : 'Add Customer'}
            </button>
            {editingId && (
              <button className="secondaryButton" type="button" onClick={() => { setEditingId(''); setForm(blankCustomer); }}>
                <X size={18} />
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel widePanel">
        <div className="sectionHeader">
          <h2>Customers</h2>
          <form className="searchBox" onSubmit={(event) => { event.preventDefault(); loadCustomers(); }}>
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" />
          </form>
        </div>
        {customers.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Site Address</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.customer_name}</td>
                    <td>{customer.mobile_number}</td>
                    <td>{customer.site_address}</td>
                    <td>{formatDate(customer.created_at)}</td>
                    <td>
                      <div className="tableActions">
                        <button type="button" className="textButton" onClick={() => editCustomer(customer)}>Edit</button>
                        <button type="button" className="iconButton small" title="Customer history" onClick={() => openHistory(customer.id)}>
                          <History size={16} />
                        </button>
                        <button type="button" className="iconButton small" title="Delete customer" onClick={() => deleteCustomer(customer.id)}>
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
          <EmptyState title="No customers found" />
        )}
      </section>

      {history && (
        <section className="panel modalPanel" role="dialog" aria-modal="true">
          <div className="sectionHeader">
            <h2>{history.customer.customer_name}</h2>
            <button className="iconButton" title="Close" type="button" onClick={() => setHistory(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="historyGrid">
            <div>
              <h3>Quotations</h3>
              {history.quotations.map((item) => (
                <p key={item.id}>{item.quotation_number} - <StatusBadge status={item.status} /> - {formatMoney(item.grand_total)}</p>
              ))}
              {!history.quotations.length && <span className="mutedText">No quotations</span>}
            </div>
            <div>
              <h3>Orders</h3>
              {history.orders.map((item) => (
                <p key={item.id}>{item.order_number} - <StatusBadge status={item.status} /></p>
              ))}
              {!history.orders.length && <span className="mutedText">No orders</span>}
            </div>
            <div>
              <h3>Invoices</h3>
              {history.invoices.map((item) => (
                <p key={item.id}>{item.invoice_number} - {formatMoney(item.final_amount)}</p>
              ))}
              {!history.invoices.length && <span className="mutedText">No invoices</span>}
            </div>
            <div>
              <h3>Payments</h3>
              {(history.payments || []).map((item) => (
                <p key={item.id}>{item.receipt_number} - {item.invoice_number || 'Ledger'} - {formatMoney(item.amount)}</p>
              ))}
              {!(history.payments || []).length && <span className="mutedText">No payments</span>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
