import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, FileText, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, formatDate, formatMoney, quotationPdfUrl, whatsappUrl } from '../api';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const SQMM_PER_SQFT = 92903.04;

const blankItem = {
  product_id: '',
  width_mm: '',
  height_mm: '',
  quantity: 1
};

const blankQuote = {
  customer_id: '',
  quotation_date: new Date().toISOString().slice(0, 10),
  transportation_charges: 0,
  installation_charges: 0,
  manufacturing_charges: 0,
  discount: 0,
  gst_percent: 18,
  notes: '',
  terms_conditions: 'This quotation covers fabrication, TRANSPORTATION and installation as specifically listed. Final production quantities remain subject to approved site measurements before manufacturing. Delivery timelines begin after design approval and advance confirmation.',
  items: [{ ...blankItem }]
};

function freshQuote() {
  return {
    ...blankQuote,
    items: [{ ...blankItem }],
    quotation_date: new Date().toISOString().slice(0, 10)
  };
}

function num(value) {
  return Number(value || 0);
}

export default function Quotations({ setNotice }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [form, setForm] = useState(freshQuote());
  const [editingId, setEditingId] = useState('');

  async function loadAll() {
    const [customerData, productData, quoteData] = await Promise.all([
      api('/api/customers'),
      api('/api/products'),
      api('/api/quotations')
    ]);
    setCustomers(customerData.customers);
    setProducts(productData.products);
    setQuotations(quoteData.quotations);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customer_id) || null,
    [customers, form.customer_id]
  );

  const calculated = useMemo(() => {
    const items = form.items.map((item) => {
      const product = productMap.get(item.product_id);
      const areaSqft = num(item.width_mm) * num(item.height_mm) / SQMM_PER_SQFT;
      const totalSqft = areaSqft * num(item.quantity);
      const amount = totalSqft * num(product?.rate_per_sqft);
      return {
        ...item,
        product_type: product?.product_name || '',
        rate_per_sqft: num(product?.rate_per_sqft),
        area_sqft: areaSqft,
        total_sqft: totalSqft,
        product_amount: amount
      };
    });
    const productTotal = items.reduce((sum, item) => sum + item.product_amount, 0);
    const subtotal = Math.max(
      productTotal + num(form.transportation_charges) + num(form.installation_charges) - num(form.discount),
      0
    );
    const subtotalWithManufacturing = Math.max(
      subtotal + num(form.manufacturing_charges),
      0
    );
    const gst = subtotalWithManufacturing * num(form.gst_percent) / 100;
    return {
      items,
      productTotal,
      subtotal: subtotalWithManufacturing,
      gst,
      grandTotal: subtotalWithManufacturing + gst
    };
  }, [form, productMap]);

  const totalMeasuredSqft = useMemo(
    () => calculated.items.reduce((sum, item) => sum + item.total_sqft, 0),
    [calculated.items]
  );

  function updateItem(index, patch) {
    const items = form.items.map((item, current) => current === index ? { ...item, ...patch } : item);
    setForm({ ...form, items });
  }

  async function submit(event) {
    event.preventDefault();
    await api(editingId ? `/api/quotations/${editingId}` : '/api/quotations', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...form,
        transportation_charges: num(form.transportation_charges),
        installation_charges: num(form.installation_charges),
        manufacturing_charges: num(form.manufacturing_charges),
        discount: num(form.discount),
        gst_percent: num(form.gst_percent)
      })
    });
    setForm(freshQuote());
    setEditingId('');
    setNotice(editingId ? 'Quotation updated' : 'Quotation created');
    await loadAll();
  }

  async function confirmQuotation(id) {
    await api(`/api/quotations/${id}/confirm`, { method: 'POST' });
    setNotice('Order confirmed');
    await loadAll();
  }

  async function editQuotation(id) {
    const data = await api(`/api/quotations/${id}`);
    setEditingId(id);
    setForm({
      customer_id: data.quotation.customer_id || '',
      quotation_date: data.quotation.quotation_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      transportation_charges: data.quotation.transportation_charges || 0,
      installation_charges: data.quotation.installation_charges || 0,
      manufacturing_charges: data.quotation.manufacturing_charges || 0,
      discount: data.quotation.discount || 0,
      gst_percent: data.quotation.gst_percent || 18,
      notes: data.quotation.notes || '',
      terms_conditions: data.quotation.terms_conditions || '',
      items: data.items.map((item) => ({
        product_id: item.product_id || '',
        width_mm: item.width_mm,
        height_mm: item.height_mm,
        quantity: item.quantity
      }))
    });
  }

  async function duplicateQuotation(id) {
    await api(`/api/quotations/${id}/duplicate`, { method: 'POST' });
    setNotice('Quotation duplicated');
    await loadAll();
  }

  async function deleteQuotation(id) {
    await api(`/api/quotations/${id}`, { method: 'DELETE' });
    setNotice('Quotation deleted');
    await loadAll();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="documentIntro">
          <div>
            <p className="sectionKicker">Quotation Workspace</p>
            <h2>{editingId ? 'Revise WINDOWS & DOORS QUOTATION' : 'WINDOWS & DOORS QUOTATION'}</h2>
            <p className="sectionLead">
              Prepare a customer-ready proposal with clear measurement-based pricing, fabrication charges,
              TRANSPORTATION, installation and tax values in one polished document.
            </p>
          </div>
          <div className="documentStamp">
            <span>{editingId ? 'Editing live quotation' : 'Ready for PDF and WhatsApp sharing'}</span>
            <strong>{selectedCustomer?.customer_name || 'Select customer to begin'}</strong>
          </div>
        </div>
        <div className="summaryCards fourUp">
          <article className="summaryCard">
            <span>Line Items</span>
            <strong>{form.items.length}</strong>
            <p>{totalMeasuredSqft.toFixed(3)} sq.ft measured</p>
          </article>
          <article className="summaryCard">
            <span>Product Value</span>
            <strong>{formatMoney(calculated.productTotal)}</strong>
            <p>Base material and fabrication total</p>
          </article>
          <article className="summaryCard">
            <span>Taxable Value</span>
            <strong>{formatMoney(calculated.subtotal)}</strong>
            <p>After service charges and discount</p>
          </article>
          <article className="summaryCard accent">
            <span>Grand Total</span>
            <strong>{formatMoney(calculated.grandTotal)}</strong>
            <p>Commercial value including GST</p>
          </article>
        </div>
        <form className="quoteForm" onSubmit={submit}>
          <section className="formSection">
            <div className="formSectionHeader">
              <div>
                <h3>Customer & Project Details</h3>
                <p>Select the customer profile and the commercial date that should appear on the quotation.</p>
              </div>
            </div>
            <div className="formGrid fourCols">
              <label className="spanTwo">
                Customer Name
                <select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} required>
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option value={customer.id} key={customer.id}>{customer.customer_name} - {customer.mobile_number}</option>
                  ))}
                </select>
              </label>
              <label>
                Quotation Date
                <input type="date" value={form.quotation_date} onChange={(event) => setForm({ ...form, quotation_date: event.target.value })} />
              </label>
            </div>
            {selectedCustomer && (
              <div className="detailStrip">
                <span>Mobile: {selectedCustomer.mobile_number || '-'}</span>
                <span>Site: {selectedCustomer.site_address || '-'}</span>
              </div>
            )}
          </section>

          <div className="splitCardGrid">
            <section className="formSection">
              <div className="formSectionHeader">
                <div>
                  <h3>Commercial Charges</h3>
                  <p>Set the additional commercial values used in the customer-facing quotation.</p>
                </div>
              </div>
              <div className="formGrid fourCols">
                <label>
                  TRANSPORTATION Charges
                  <input type="number" min="0" step="0.01" value={form.transportation_charges} onChange={(event) => setForm({ ...form, transportation_charges: event.target.value })} />
                </label>
                <label>
                  Installation Charges
                  <input type="number" min="0" step="0.01" value={form.installation_charges} onChange={(event) => setForm({ ...form, installation_charges: event.target.value })} />
                </label>
                <label>
                  Manufacturing Charges
                  <input type="number" min="0" step="0.01" value={form.manufacturing_charges} onChange={(event) => setForm({ ...form, manufacturing_charges: event.target.value })} />
                </label>
                <label>
                  Discount
                  <input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} />
                </label>
                <label>
                  GST %
                  <input type="number" min="0" max="28" step="0.01" value={form.gst_percent} onChange={(event) => setForm({ ...form, gst_percent: event.target.value })} />
                </label>
              </div>
            </section>

            <aside className="summaryPanel">
              <p className="sectionKicker">Commercial Snapshot</p>
              <h3>Quotation Cost Summary</h3>
              <div className="summaryList">
                <div className="summaryListRow">
                  <span>Products</span>
                  <strong>{formatMoney(calculated.productTotal)}</strong>
                </div>
                <div className="summaryListRow">
                  <span>TRANSPORTATION</span>
                  <strong>{formatMoney(form.transportation_charges)}</strong>
                </div>
                <div className="summaryListRow">
                  <span>Installation + Manufacturing</span>
                  <strong>{formatMoney(num(form.installation_charges) + num(form.manufacturing_charges))}</strong>
                </div>
                <div className="summaryListRow">
                  <span>GST Value</span>
                  <strong>{formatMoney(calculated.gst)}</strong>
                </div>
                <div className="summaryListRow emphasis">
                  <span>Grand Total</span>
                  <strong>{formatMoney(calculated.grandTotal)}</strong>
                </div>
              </div>
            </aside>
          </div>

          <section className="formSection">
            <div className="itemsHeader">
              <div>
                <h3>Quotation Items</h3>
                <p className="sectionLead compact">Add product sizes in millimetres and let the document calculate square footage automatically.</p>
              </div>
              <button className="secondaryButton" type="button" onClick={() => setForm({ ...form, items: [...form.items, { ...blankItem }] })}>
                <Plus size={18} />
                Add Item
              </button>
            </div>

            <div className="tableWrap">
              <table className="editableTable">
                <thead>
                  <tr>
                    <th>Product Type</th>
                    <th>Width (mm)</th>
                    <th>Height (mm)</th>
                    <th>Quantity</th>
                    <th>Total Sq.Ft</th>
                    <th>Rate Per Sq.Ft</th>
                    <th className="amountCell">Product Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <select value={item.product_id} onChange={(event) => updateItem(index, { product_id: event.target.value })} required>
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option value={product.id} key={product.id}>{product.product_name}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="number" min="1" value={item.width_mm} onChange={(event) => updateItem(index, { width_mm: event.target.value })} required /></td>
                      <td><input type="number" min="1" value={item.height_mm} onChange={(event) => updateItem(index, { height_mm: event.target.value })} required /></td>
                      <td><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} required /></td>
                      <td>{calculated.items[index].total_sqft.toFixed(3)}</td>
                      <td>{formatMoney(calculated.items[index].rate_per_sqft)}</td>
                      <td className="amountCell">{formatMoney(calculated.items[index].product_amount)}</td>
                      <td>
                        <button
                          className="iconButton small"
                          type="button"
                          title="Remove item"
                          disabled={form.items.length === 1}
                          onClick={() => setForm({ ...form, items: form.items.filter((_, current) => current !== index) })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="formSection">
            <div className="formSectionHeader">
              <div>
                <h3>Notes & Terms</h3>
                <p>Use concise commercial notes and customer-facing terms so the quotation reads like a finished business document.</p>
              </div>
            </div>
            <div className="formGrid noteGrid">
              <label>
                Notes
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Any special finish, glazing, hardware or project coordination remarks." />
              </label>
              <label>
                Terms & Conditions
                <textarea value={form.terms_conditions} onChange={(event) => setForm({ ...form, terms_conditions: event.target.value })} />
              </label>
            </div>
          </section>

          <div className="totalsBar">
            <span>Subtotal <strong>{formatMoney(calculated.subtotal)}</strong></span>
            <span>GST <strong>{formatMoney(calculated.gst)}</strong></span>
            <span>Grand Total <strong>{formatMoney(calculated.grandTotal)}</strong></span>
            <button className="primaryButton" type="submit">
              <FileText size={18} />
              {editingId ? 'Save Quotation' : 'Generate Quotation'}
            </button>
            {editingId && (
              <button className="secondaryButton" type="button" onClick={() => { setEditingId(''); setForm(freshQuote()); }}>
                <X size={18} />
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <p className="sectionKicker">Register</p>
            <h2>Recent Quotations</h2>
          </div>
        </div>
        {quotations.length ? (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.quotation_number}</td>
                    <td>{formatDate(quote.quotation_date)}</td>
                    <td>{quote.customer_name}</td>
                    <td>{quote.mobile_number}</td>
                    <td><StatusBadge status={quote.status} /></td>
                    <td className="amountCell">{formatMoney(quote.grand_total)}</td>
                    <td>
                      <div className="tableActions">
                        {quote.status === 'Quotation Created' && (
                          <button className="iconButton small" title="Convert to order" type="button" onClick={() => confirmQuotation(quote.id)}>
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        <button className="iconButton small" title="Edit quotation" type="button" onClick={() => editQuotation(quote.id)}><Pencil size={15} /></button>
                        <button className="iconButton small" title="Duplicate quotation" type="button" onClick={() => duplicateQuotation(quote.id)}><Copy size={15} /></button>
                        <a className="iconButton small" title="Download PDF" href={`${quotationPdfUrl(quote.id)}?download=true`}><Download size={15} /></a>
                        <a
                          className="iconButton small"
                          title="Share on WhatsApp"
                          href={whatsappUrl(`Quotation ${quote.quotation_number} from SHREE UPVC WINDOWS & DOORS. Total value: ${formatMoney(quote.grand_total)}. Please review the product configuration and commercial terms.`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={15} />
                        </a>
                        <button className="iconButton small" title="Delete quotation" type="button" onClick={() => deleteQuotation(quote.id)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No quotations found" />
        )}
      </section>
    </div>
  );
}
