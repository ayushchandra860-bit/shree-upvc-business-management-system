import { useEffect, useMemo, useState } from 'react';
import { Download, MessageCircle, Pencil, Printer, ReceiptText, Save, Trash2, X } from 'lucide-react';
import { api, formatDate, formatMoney, pdfUrl, whatsappUrl } from '../api';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Invoices({ setNotice }) {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [source, setSource] = useState('order');
  const [sourceId, setSourceId] = useState('');
  const [editingInvoice, setEditingInvoice] = useState(null);

  async function loadAll() {
    const [invoiceData, orderData, quoteData] = await Promise.all([
      api('/api/invoices'),
      api('/api/orders'),
      api('/api/quotations')
    ]);
    setInvoices(invoiceData.invoices);
    setOrders(orderData.orders);
    setQuotations(quoteData.quotations);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const options = useMemo(() => (
    source === 'order'
      ? orders.map((order) => ({
        id: order.id,
        label: `${order.order_number} - ${order.customer_name} - ${formatMoney(order.total_amount)}`
      }))
      : quotations.map((quote) => ({
        id: quote.id,
        label: `${quote.quotation_number} - ${quote.customer_name} - ${formatMoney(quote.grand_total)}`
      }))
  ), [source, orders, quotations]);

  async function submit(event) {
    event.preventDefault();
    await api('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(source === 'order' ? { order_id: sourceId } : { quotation_id: sourceId })
    });
    setSourceId('');
    setNotice('Invoice generated');
    await loadAll();
  }

  function printInvoice(id) {
    window.open(pdfUrl(id), '_blank', 'noopener,noreferrer');
  }

  async function editInvoice(id) {
    const data = await api(`/api/invoices/${id}`);
    setEditingInvoice({
      id,
      invoice_date: data.invoice.invoice_date?.slice(0, 10) || '',
      transportation_charges: data.invoice.transportation_charges || 0,
      installation_charges: data.invoice.installation_charges || 0,
      manufacturing_charges: data.invoice.manufacturing_charges || 0,
      discount: data.invoice.discount || 0,
      gst_percent: data.invoice.gst_percent || 18,
      notes: data.invoice.notes || '',
      terms_conditions: data.invoice.terms_conditions || ''
    });
  }

  async function saveInvoice(event) {
    event.preventDefault();
    await api(`/api/invoices/${editingInvoice.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...editingInvoice,
        transportation_charges: Number(editingInvoice.transportation_charges),
        installation_charges: Number(editingInvoice.installation_charges),
        manufacturing_charges: Number(editingInvoice.manufacturing_charges),
        discount: Number(editingInvoice.discount),
        gst_percent: Number(editingInvoice.gst_percent)
      })
    });
    setEditingInvoice(null);
    setNotice('Invoice updated');
    await loadAll();
  }

  async function deleteInvoice(id) {
    await api(`/api/invoices/${id}`, { method: 'DELETE' });
    setNotice('Invoice deleted');
    await loadAll();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader">
          <h2>Generate Invoice</h2>
        </div>
        <form className="formGrid invoiceForm" onSubmit={submit}>
          <label>
            Source
            <select value={source} onChange={(event) => { setSource(event.target.value); setSourceId(''); }}>
              <option value="order">Order</option>
              <option value="quotation">Quotation</option>
            </select>
          </label>
          <label className="spanTwo">
            {source === 'order' ? 'Order' : 'Quotation'}
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} required>
              <option value="">Select {source}</option>
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <button className="primaryButton" type="submit">
            <ReceiptText size={18} />
            Generate Invoice
          </button>
        </form>
      </section>

      {editingInvoice && (
        <section className="panel">
          <div className="sectionHeader">
            <h2>Edit Invoice</h2>
            <button className="iconButton" title="Cancel edit" type="button" onClick={() => setEditingInvoice(null)}><X size={18} /></button>
          </div>
          <form className="formGrid fourCols" onSubmit={saveInvoice}>
            <label>Invoice Date<input type="date" value={editingInvoice.invoice_date} onChange={(event) => setEditingInvoice({ ...editingInvoice, invoice_date: event.target.value })} /></label>
            <label>Transportation<input type="number" min="0" value={editingInvoice.transportation_charges} onChange={(event) => setEditingInvoice({ ...editingInvoice, transportation_charges: event.target.value })} /></label>
            <label>Installation<input type="number" min="0" value={editingInvoice.installation_charges} onChange={(event) => setEditingInvoice({ ...editingInvoice, installation_charges: event.target.value })} /></label>
            <label>Manufacturing<input type="number" min="0" value={editingInvoice.manufacturing_charges} onChange={(event) => setEditingInvoice({ ...editingInvoice, manufacturing_charges: event.target.value })} /></label>
            <label>Discount<input type="number" min="0" value={editingInvoice.discount} onChange={(event) => setEditingInvoice({ ...editingInvoice, discount: event.target.value })} /></label>
            <label>GST %<input type="number" min="0" max="28" value={editingInvoice.gst_percent} onChange={(event) => setEditingInvoice({ ...editingInvoice, gst_percent: event.target.value })} /></label>
            <label className="spanTwo">Notes<input value={editingInvoice.notes} onChange={(event) => setEditingInvoice({ ...editingInvoice, notes: event.target.value })} /></label>
            <label className="spanTwo">Terms & Conditions<textarea value={editingInvoice.terms_conditions} onChange={(event) => setEditingInvoice({ ...editingInvoice, terms_conditions: event.target.value })} /></label>
            <button className="primaryButton" type="submit"><Save size={18} />Save Invoice</button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="sectionHeader">
          <h2>Invoices</h2>
        </div>
        {invoices.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th className="amountCell">Final Amount</th>
                  <th>Payment</th>
                  <th>Buttons</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number}</td>
                    <td>{formatDate(invoice.invoice_date)}</td>
                    <td>
                      <strong>{invoice.customer_name}</strong>
                      <span className="subText">{invoice.mobile_number}</span>
                    </td>
                    <td>{invoice.order_number || invoice.quotation_number}</td>
                    <td className="amountCell">{formatMoney(invoice.final_amount)}</td>
                    <td>
                      <StatusBadge status={invoice.payment_status} />
                      <span className="subText">Due {formatMoney(invoice.remaining_amount)}</span>
                    </td>
                    <td>
                      <div className="tableActions">
                        <a className="iconButton small" title="Download PDF" href={`${pdfUrl(invoice.id)}?download=true`}>
                          <Download size={16} />
                        </a>
                        <button className="iconButton small" title="Print invoice" type="button" onClick={() => printInvoice(invoice.id)}>
                          <Printer size={16} />
                        </button>
                        <button className="iconButton small" title="Edit invoice" type="button" onClick={() => editInvoice(invoice.id)}><Pencil size={16} /></button>
                        <a
                          className="iconButton small"
                          title="Share on WhatsApp"
                          href={whatsappUrl(`Invoice ${invoice.invoice_number} from SHREE UPVC WINDOWS & DOORS. Amount: ${formatMoney(invoice.final_amount)}. Due: ${formatMoney(invoice.remaining_amount)}`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={16} />
                        </a>
                        <button className="iconButton small" title="Delete invoice" type="button" onClick={() => deleteInvoice(invoice.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No invoices found" />
        )}
      </section>
    </div>
  );
}
