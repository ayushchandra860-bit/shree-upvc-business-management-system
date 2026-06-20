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

  const invoiceSummary = useMemo(() => (
    invoices.reduce((summary, invoice) => ({
      count: summary.count + 1,
      finalAmount: summary.finalAmount + Number(invoice.final_amount || 0),
      paidAmount: summary.paidAmount + Number(invoice.paid_amount || 0),
      outstanding: summary.outstanding + Number(invoice.remaining_amount || 0)
    }), {
      count: 0,
      finalAmount: 0,
      paidAmount: 0,
      outstanding: 0
    })
  ), [invoices]);

  const editingSummary = useMemo(() => {
    if (!editingInvoice) return null;

    const subtotal = Number(
      invoices.find((invoice) => invoice.id === editingInvoice.id)?.subtotal || 0
    );
    const transportation = Number(editingInvoice.transportation_charges || 0);
    const installation = Number(editingInvoice.installation_charges || 0);
    const manufacturing = Number(editingInvoice.manufacturing_charges || 0);
    const discount = Number(editingInvoice.discount || 0);
    const gstPercent = Number(editingInvoice.gst_percent || 0);
    const taxable = Math.max(subtotal + transportation + installation + manufacturing - discount, 0);
    const gstAmount = taxable * gstPercent / 100;

    return {
      subtotal,
      taxable,
      gstAmount,
      finalAmount: taxable + gstAmount
    };
  }, [editingInvoice, invoices]);

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
          <div>
            <p className="sectionKicker">Billing</p>
            <h2>Invoices</h2>
            <p className="panelLead">Create, edit, print and share invoices with a cleaner billing flow.</p>
          </div>
        </div>
        <div className="miniStatsRow">
          <article className="miniStat">
            <span>Total Invoices</span>
            <strong>{invoiceSummary.count}</strong>
          </article>
          <article className="miniStat">
            <span>Total Billed</span>
            <strong>{formatMoney(invoiceSummary.finalAmount)}</strong>
          </article>
          <article className="miniStat">
            <span>Received</span>
            <strong>{formatMoney(invoiceSummary.paidAmount)}</strong>
          </article>
          <article className="miniStat emphasis">
            <span>Outstanding</span>
            <strong>{formatMoney(invoiceSummary.outstanding)}</strong>
          </article>
        </div>
        <form className="formGrid invoiceForm" onSubmit={submit}>
          <label>
            Invoice Source
            <select value={source} onChange={(event) => { setSource(event.target.value); setSourceId(''); }}>
              <option value="order">Order</option>
              <option value="quotation">Quotation</option>
            </select>
          </label>
          <label className="spanTwo">
            {source === 'order' ? 'Order Reference' : 'Quotation Reference'}
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} required>
              <option value="">Select {source}</option>
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <button className="primaryButton" type="submit">
            <ReceiptText size={18} />
            Create Invoice
          </button>
        </form>
      </section>

      {editingInvoice && (
        <section className="panel">
          <div className="sectionHeader">
            <div>
              <p className="sectionKicker">Document Editor</p>
              <h2>Edit Invoice</h2>
            </div>
            <button className="iconButton" title="Cancel edit" type="button" onClick={() => setEditingInvoice(null)}><X size={18} /></button>
          </div>
          <form className="formSection invoiceEditor" onSubmit={saveInvoice}>
            <div className="formGrid fourCols">
              <label>Invoice Date<input type="date" value={editingInvoice.invoice_date} onChange={(event) => setEditingInvoice({ ...editingInvoice, invoice_date: event.target.value })} /></label>
              <label>TRANSPORTATION<input type="number" min="0" value={editingInvoice.transportation_charges} onChange={(event) => setEditingInvoice({ ...editingInvoice, transportation_charges: event.target.value })} /></label>
              <label>Installation<input type="number" min="0" value={editingInvoice.installation_charges} onChange={(event) => setEditingInvoice({ ...editingInvoice, installation_charges: event.target.value })} /></label>
              <label>Manufacturing<input type="number" min="0" value={editingInvoice.manufacturing_charges} onChange={(event) => setEditingInvoice({ ...editingInvoice, manufacturing_charges: event.target.value })} /></label>
              <label>Discount<input type="number" min="0" value={editingInvoice.discount} onChange={(event) => setEditingInvoice({ ...editingInvoice, discount: event.target.value })} /></label>
              <label>GST %<input type="number" min="0" max="28" value={editingInvoice.gst_percent} onChange={(event) => setEditingInvoice({ ...editingInvoice, gst_percent: event.target.value })} /></label>
            </div>
            <div className="inlineSummaryBar">
              <span className="inlineSummaryPill">Subtotal <strong>{formatMoney(editingSummary?.subtotal)}</strong></span>
              <span className="inlineSummaryPill">Taxable <strong>{formatMoney(editingSummary?.taxable)}</strong></span>
              <span className="inlineSummaryPill">GST <strong>{formatMoney(editingSummary?.gstAmount)}</strong></span>
              <span className="inlineSummaryPill emphasis">Final Amount <strong>{formatMoney(editingSummary?.finalAmount)}</strong></span>
            </div>
            <div className="formGrid noteGrid">
              <label>Notes<textarea value={editingInvoice.notes} onChange={(event) => setEditingInvoice({ ...editingInvoice, notes: event.target.value })} placeholder="Delivery note, payment note or customer-specific billing note." /></label>
              <label>Terms & Conditions<textarea value={editingInvoice.terms_conditions} onChange={(event) => setEditingInvoice({ ...editingInvoice, terms_conditions: event.target.value })} /></label>
            </div>
            <button className="primaryButton" type="submit"><Save size={18} />Save Invoice</button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <p className="sectionKicker">Register</p>
            <h2>Invoice Register</h2>
          </div>
        </div>
        {invoices.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th className="amountCell">Final Amount</th>
                  <th>Payment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoice_number}</strong>
                      <span className="subText">{formatDate(invoice.invoice_date)}</span>
                    </td>
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
                          href={whatsappUrl(`Invoice ${invoice.invoice_number} from SHREE UPVC WINDOWS & DOORS. Invoice value: ${formatMoney(invoice.final_amount)}. Outstanding amount: ${formatMoney(invoice.remaining_amount)}.`)}
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
