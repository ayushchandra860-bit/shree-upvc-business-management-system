import { useEffect, useState } from 'react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { api, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';

export default function Suppliers({ setNotice }) {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ supplier_name: '', mobile: '', address: '', gst_number: '', opening_balance: 0, active: true });
  const [editingId, setEditingId] = useState('');
  const [payment, setPayment] = useState({ supplier_id: '', amount: '', payment_type: 'Payment', payment_mode: 'Cash', notes: '' });

  async function loadSuppliers() {
    const data = await api('/api/suppliers');
    setSuppliers(data.suppliers);
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function saveSupplier(event) {
    event.preventDefault();
    await api(editingId ? `/api/suppliers/${editingId}` : '/api/suppliers', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, opening_balance: Number(form.opening_balance) })
    });
    setNotice(editingId ? 'Supplier updated' : 'Supplier added');
    setEditingId('');
    setForm({ supplier_name: '', mobile: '', address: '', gst_number: '', opening_balance: 0, active: true });
    await loadSuppliers();
  }

  function editSupplier(supplier) {
    setEditingId(supplier.id);
    setForm({
      supplier_name: supplier.supplier_name,
      mobile: supplier.mobile || '',
      address: supplier.address || '',
      gst_number: supplier.gst_number || '',
      opening_balance: supplier.opening_balance || 0,
      active: supplier.active
    });
  }

  async function deleteSupplier(supplierId) {
    await api(`/api/suppliers/${supplierId}`, { method: 'DELETE' });
    setNotice('Supplier deactivated');
    await loadSuppliers();
  }

  async function savePayment(event) {
    event.preventDefault();
    await api(`/api/suppliers/${payment.supplier_id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ ...payment, amount: Number(payment.amount) })
    });
    setNotice('Supplier payment saved');
    setPayment({ supplier_id: '', amount: '', payment_type: 'Payment', payment_mode: 'Cash', notes: '' });
    await loadSuppliers();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader"><h2>{editingId ? 'Edit Supplier' : 'Supplier Management'}</h2></div>
        <form className="formGrid fourCols" onSubmit={saveSupplier}>
          <label>Supplier Name<input value={form.supplier_name} onChange={(event) => setForm({ ...form, supplier_name: event.target.value })} required /></label>
          <label>Mobile<input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label>
          <label>GST Number<input value={form.gst_number} onChange={(event) => setForm({ ...form, gst_number: event.target.value })} /></label>
          <label>Opening Balance<input type="number" value={form.opening_balance} onChange={(event) => setForm({ ...form, opening_balance: event.target.value })} /></label>
          <label className="spanTwo">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <button className="primaryButton" type="submit"><Save size={18} />{editingId ? 'Save Supplier' : 'Add Supplier'}</button>
          {editingId && <button className="secondaryButton" type="button" onClick={() => { setEditingId(''); setForm({ supplier_name: '', mobile: '', address: '', gst_number: '', opening_balance: 0, active: true }); }}><X size={18} />Cancel</button>}
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Supplier Payment / Advance</h2></div>
        <form className="formGrid fourCols" onSubmit={savePayment}>
          <label className="spanTwo">Supplier<select value={payment.supplier_id} onChange={(event) => setPayment({ ...payment, supplier_id: event.target.value })} required><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}</select></label>
          <label>Amount<input type="number" min="1" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} required /></label>
          <label>Type<select value={payment.payment_type} onChange={(event) => setPayment({ ...payment, payment_type: event.target.value })}><option>Payment</option><option>Advance</option></select></label>
          <label>Mode<input value={payment.payment_mode} onChange={(event) => setPayment({ ...payment, payment_mode: event.target.value })} /></label>
          <label className="spanTwo">Notes<input value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} /></label>
          <button className="primaryButton" type="submit">Save Payment</button>
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Supplier List</h2></div>
        {suppliers.length ? (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Supplier</th><th>Mobile</th><th>GST</th><th className="amountCell">Opening</th><th className="amountCell">Paid / Advance</th><th className="amountCell">Pending Balance</th><th>Actions</th></tr></thead>
              <tbody>{suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.supplier_name}<span className="subText">{supplier.address}</span></td>
                  <td>{supplier.mobile}</td><td>{supplier.gst_number}</td>
                  <td className="amountCell">{formatMoney(supplier.opening_balance)}</td>
                  <td className="amountCell">{formatMoney(supplier.total_paid)}</td>
                  <td className="amountCell">{formatMoney(supplier.pending_balance)}</td>
                  <td><div className="tableActions"><button className="iconButton small" title="Edit supplier" type="button" onClick={() => editSupplier(supplier)}><Pencil size={16} /></button><button className="iconButton small" title="Deactivate supplier" type="button" onClick={() => deleteSupplier(supplier.id)}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No suppliers found" />}
      </section>
    </div>
  );
}
