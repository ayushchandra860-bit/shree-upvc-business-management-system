import { useEffect, useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { api, formatDate, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';

const reportTypes = [
  ['daily_sales', 'Daily Sales Report'],
  ['monthly_sales', 'Monthly Sales Report'],
  ['customer_wise', 'Customer-wise Report'],
  ['employee', 'Employee Report'],
  ['expense', 'Expense Report'],
  ['revenue', 'Revenue Report'],
  ['profit_loss', 'Profit & Loss Report']
];

export default function Reports({ setNotice }) {
  const [customers, setCustomers] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({
    report_type: 'daily_sales',
    date: new Date().toISOString().slice(0, 10),
    month: new Date().toISOString().slice(0, 7),
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
    customer_id: ''
  });

  async function loadMeta() {
    const [customerData, snapshotData] = await Promise.all([
      api('/api/customers'),
      api('/api/reports/snapshots')
    ]);
    setCustomers(customerData.customers);
    setSnapshots(snapshotData.snapshots);
  }

  useEffect(() => {
    loadMeta();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const data = await api('/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        customer_id: form.customer_id || undefined
      })
    });
    setReport(data.report);
    setNotice('Report generated');
    await loadMeta();
  }

  function exportExcel() {
    if (!report) return;
    const rows = Object.entries(report)
      .filter(([, value]) => Array.isArray(value))
      .flatMap(([section, value]) => value.map((row) => ({ section, ...row })));
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const html = `<table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${row[column] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title || 'report'}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pageGrid">
      <section className="panel">
        <div className="sectionHeader">
          <h2>Generate Report</h2>
        </div>
        <form className="formGrid" onSubmit={submit}>
          <label className="spanTwo">
            Report Type
            <select value={form.report_type} onChange={(event) => setForm({ ...form, report_type: event.target.value })}>
              {reportTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {form.report_type === 'daily_sales' && (
            <label>
              Date
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
          )}
          {form.report_type === 'monthly_sales' && (
            <label>
              Month
              <input type="month" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} />
            </label>
          )}
          {form.report_type === 'customer_wise' && (
            <label className="spanTwo">
              Customer
              <select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}>
                <option value="">All customers</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_name}</option>)}
              </select>
            </label>
          )}
          {['revenue', 'expense', 'profit_loss'].includes(form.report_type) && (
            <>
              <label>
                From Date
                <input type="date" value={form.from_date} onChange={(event) => setForm({ ...form, from_date: event.target.value })} />
              </label>
              <label>
                To Date
                <input type="date" value={form.to_date} onChange={(event) => setForm({ ...form, to_date: event.target.value })} />
              </label>
            </>
          )}
          <button className="primaryButton" type="submit">
            <BarChart3 size={18} />
            Generate Report
          </button>
        </form>
      </section>

      <section className="panel widePanel">
        <div className="sectionHeader">
          <h2>{report?.title || 'Report Output'}</h2>
          {report && (
            <div className="buttonRow">
              <button className="secondaryButton" type="button" onClick={() => window.print()}><Printer size={18} />Export PDF</button>
              <button className="secondaryButton" type="button" onClick={exportExcel}><Download size={18} />Export Excel</button>
            </div>
          )}
        </div>
        {report ? (
          <ReportTable report={report} />
        ) : (
          <EmptyState title="No report selected" />
        )}
      </section>

      <section className="panel widePanel">
        <div className="sectionHeader">
          <h2>Stored Reports</h2>
        </div>
        {snapshots.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Period Start</th>
                  <th>Period End</th>
                  <th>Generated</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{reportTypes.find(([value]) => value === snapshot.report_type)?.[1]}</td>
                    <td>{formatDate(snapshot.period_start)}</td>
                    <td>{formatDate(snapshot.period_end)}</td>
                    <td>{formatDate(snapshot.generated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No stored reports" />
        )}
      </section>
    </div>
  );
}

function ReportTable({ report }) {
  if (report.invoices) {
    return (
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th className="amountCell">Final Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.invoices.map((invoice) => (
              <tr key={invoice.invoice_number}>
                <td>{invoice.invoice_number}</td>
                <td>{formatDate(invoice.invoice_date)}</td>
                <td>{invoice.customer_name}</td>
                <td className="amountCell">{formatMoney(invoice.final_amount)}</td>
              </tr>
            ))}
            <tr className="summaryRow">
              <td colSpan="3">Total Sales</td>
              <td className="amountCell">{formatMoney(report.total_sales)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (report.customers) {
    return (
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Invoices</th>
              <th className="amountCell">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.customers.map((customer) => (
              <tr key={customer.customer_id || customer.customer_name}>
                <td>{customer.customer_name}</td>
                <td>{customer.invoice_count}</td>
                <td className="amountCell">{formatMoney(customer.total_revenue)}</td>
              </tr>
            ))}
            <tr className="summaryRow">
              <td colSpan="2">Total Revenue</td>
              <td className="amountCell">{formatMoney(report.total_revenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (report.employees) {
    return (
      <div className="tableWrap">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Designation</th><th>Salary Type</th><th className="amountCell">Base</th><th className="amountCell">Pending</th><th className="amountCell">Advance</th></tr></thead>
          <tbody>{report.employees.map((employee) => (
            <tr key={employee.employee_code}>
              <td>{employee.employee_code}</td><td>{employee.name}</td><td>{employee.designation}</td><td>{employee.salary_type}</td>
              <td className="amountCell">{formatMoney(employee.base_salary)}</td>
              <td className="amountCell">{formatMoney(employee.pending_salary)}</td>
              <td className="amountCell">{formatMoney(employee.advance_balance)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  if (report.expenses) {
    return (
      <div className="tableWrap">
        <table>
          <thead><tr><th>Category</th><th>Entries</th><th className="amountCell">Total</th></tr></thead>
          <tbody>
            {report.expenses.map((expense) => (
              <tr key={expense.category}><td>{expense.category}</td><td>{expense.expense_count}</td><td className="amountCell">{formatMoney(expense.total_amount)}</td></tr>
            ))}
            <tr className="summaryRow"><td colSpan="2">Total Expenses</td><td className="amountCell">{formatMoney(report.total_expenses)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (report.net_profit !== undefined) {
    return (
      <div className="statsGrid">
        <article className="statCard"><span>Total Revenue</span><strong>{formatMoney(report.total_revenue)}</strong></article>
        <article className="statCard"><span>Total Expenses</span><strong>{formatMoney(report.total_expenses)}</strong></article>
        <article className="statCard"><span>Net Profit</span><strong>{formatMoney(report.net_profit)}</strong></article>
      </div>
    );
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Invoices</th>
            <th className="amountCell">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {report.days.map((day) => (
            <tr key={day.invoice_date}>
              <td>{formatDate(day.invoice_date)}</td>
              <td>{day.invoice_count}</td>
              <td className="amountCell">{formatMoney(day.total_revenue)}</td>
            </tr>
          ))}
          <tr className="summaryRow">
            <td colSpan="2">Total Revenue</td>
            <td className="amountCell">{formatMoney(report.total_revenue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
