import { useEffect, useState } from 'react';
import { MessageCircle, Printer, Save, Trash2 } from 'lucide-react';
import { api, formatDate, formatMoney, receiptUrl, whatsappUrl } from '../api';
import EmptyState from '../components/EmptyState.jsx';

const blankPayment = {
  invoice_id: '',
  payment_date: new Date().toISOString().slice(0, 10),
  amount: '',
  payment_mode: 'Cash',
  reference_number: '',
  notes: ''
};

export default function Payments({ setNotice }) {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState(blankPayment);
  const [editingId, setEditingId] = useState('');

  async function loadAll() {
    const [paymentData, invoiceData] = await Promise.all([
      api('/api/payments'),
      api('/api/invoices')
    ]);
    setPayments(paymentData.payments);
    setInvoices(invoiceData.invoices);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submit(event) {
    event.preventDefault();
    await api(editingId ? `/api/payments/${editingId}` : '/api/payments', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, amount: Number(form.amount) })
    });
    setForm(blankPayment);
    setEditingId('');
    setNotice(editingId ? 'Payment updated' : 'Payment added');
    await loadAll();
  }

  async function removePayment(id) {
    await api(`/api/payments/${id}`, { method: 'DELETE' });
    setNotice('Payment deleted');
    await loadAll();
  }

  function edit(payment) {
    setEditingId(payment.id);
    setForm({
      invoice_id: payment.invoice_id || '',
      payment_date: payment.payment_date?.slice(0, 10) || blankPayment.payment_date,
      amount: payment.amount,
      payment_mode: payment.payment_mode,
      reference_number: payment.reference_number || '',
      notes: payment.notes || ''
    });
  }

  return (
    <div className="pageStack">
      <section className="statsGrid">
        <article className="statCard"><span>Total Invoice Amount</span><strong>{formatMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.final_amount || 0), 0))}</strong></article>
        <article className="statCard"><span>Received Amount</span><strong>{formatMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0))}</strong></article>
        <article className="statCard"><span>Remaining Amount</span><strong>{formatMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.remaining_amount || 0), 0))}</strong></article>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Payment Management</h2></div>
        <form className="formGrid fourCols" onSubmit={submit}>
          <label className="spanTwo">
            Invoice
            <select value={form.invoice_id} onChange={(event) => setForm({ ...form, invoice_id: event.target.value })} required>
              <option value="">Select invoice</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.customer_name} - Due {formatMoney(invoice.remaining_amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment Date
            <input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} />
          </label>
          <label>
            Amount
            <input type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
          </label>
          <label>
            Payment Mode
            <input value={form.payment_mode} onChange={(event) => setForm({ ...form, payment_mode: event.target.value })} />
          </label>
          <label>
            Reference Number
            <input value={form.reference_number} onChange={(event) => setForm({ ...form, reference_number: event.target.value })} />
          </label>
          <label className="spanTwo">
            Notes
            <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <button className="primaryButton" type="submit"><Save size={18} />{editingId ? 'Save Payment' : 'Add Payment'}</button>
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Payment History</h2></div>
        {payments.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Mode</th><th className="amountCell">Amount</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.receipt_number}</td>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td>{payment.customer_name}</td>
                    <td>{payment.invoice_number}</td>
                    <td>{payment.payment_mode}</td>
                    <td className="amountCell">{formatMoney(payment.amount)}</td>
                    <td>
                      <div className="tableActions">
                        <button className="textButton" type="button" onClick={() => edit(payment)}>Edit</button>
                        <a className="iconButton small" title="Print receipt" href={receiptUrl(payment.id)} target="_blank" rel="noreferrer"><Printer size={16} /></a>
                        <a
                          className="iconButton small"
                          title="Share payment reminder"
                          href={whatsappUrl(`Payment reminder from SHREE UPVC WINDOWS & DOORS for invoice ${payment.invoice_number || ''}. Received: ${formatMoney(payment.amount)}.`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={16} />
                        </a>
                        <button className="iconButton small" title="Delete payment" type="button" onClick={() => removePayment(payment.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No payments found" />}
      </section>
    </div>
  );
}
