import { useEffect, useState } from 'react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { api, formatDate, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';

export default function Expenses({ setNotice }) {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ expense_date: new Date().toISOString().slice(0, 10), category: 'Material Purchase', amount: '', paid_to: '', payment_mode: 'Cash', notes: '' });
  const [editingId, setEditingId] = useState('');

  async function loadExpenses() {
    const data = await api('/api/expenses');
    setExpenses(data.expenses);
    setCategories(data.categories);
  }

  useEffect(() => {
    loadExpenses();
  }, []);

  async function submit(event) {
    event.preventDefault();
    await api(editingId ? `/api/expenses/${editingId}` : '/api/expenses', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, amount: Number(form.amount) })
    });
    setNotice(editingId ? 'Expense updated' : 'Expense added');
    setEditingId('');
    setForm({ ...form, amount: '', paid_to: '', notes: '' });
    await loadExpenses();
  }

  function editExpense(expense) {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      category: expense.category,
      amount: expense.amount,
      paid_to: expense.paid_to || '',
      payment_mode: expense.payment_mode || 'Cash',
      notes: expense.notes || ''
    });
  }

  async function removeExpense(id) {
    await api(`/api/expenses/${id}`, { method: 'DELETE' });
    setNotice('Expense deleted');
    await loadExpenses();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader"><h2>{editingId ? 'Edit Expense' : 'Expense Management'}</h2></div>
        <form className="formGrid fourCols" onSubmit={submit}>
          <label>Date<input type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} /></label>
          <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Amount<input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
          <label>Paid To<input value={form.paid_to} onChange={(event) => setForm({ ...form, paid_to: event.target.value })} /></label>
          <label>Payment Mode<input value={form.payment_mode} onChange={(event) => setForm({ ...form, payment_mode: event.target.value })} /></label>
          <label className="spanTwo">Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <button className="primaryButton" type="submit"><Save size={18} />{editingId ? 'Save Expense' : 'Add Expense'}</button>
          {editingId && <button className="secondaryButton" type="button" onClick={() => { setEditingId(''); setForm({ expense_date: new Date().toISOString().slice(0, 10), category: 'Material Purchase', amount: '', paid_to: '', payment_mode: 'Cash', notes: '' }); }}><X size={18} />Cancel</button>}
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Expense Report</h2></div>
        {expenses.length ? (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Paid To</th><th>Mode</th><th className="amountCell">Amount</th><th>Action</th></tr></thead>
              <tbody>{expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expense_date)}</td><td>{expense.category}</td><td>{expense.paid_to}</td><td>{expense.payment_mode}</td><td className="amountCell">{formatMoney(expense.amount)}</td>
                  <td><div className="tableActions"><button className="iconButton small" title="Edit expense" type="button" onClick={() => editExpense(expense)}><Pencil size={16} /></button><button className="iconButton small" title="Delete expense" type="button" onClick={() => removeExpense(expense.id)}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No expenses found" />}
      </section>
    </div>
  );
}
