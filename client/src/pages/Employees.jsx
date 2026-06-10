import { useEffect, useState } from 'react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { api, formatMoney } from '../api';
import EmptyState from '../components/EmptyState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const today = new Date().toISOString().slice(0, 10);
const month = new Date().toISOString().slice(0, 7);

export default function Employees({ setNotice }) {
  const [employees, setEmployees] = useState([]);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({
    name: '', mobile: '', address: '', aadhaar: '', joining_date: today,
    designation: '', salary_type: 'Monthly', base_salary: 0, active: true
  });
  const [attendance, setAttendance] = useState({ employee_id: '', attendance_date: today, status: 'Present', notes: '' });
  const [advance, setAdvance] = useState({ employee_id: '', advance_date: today, amount: '', reason: '' });
  const [salary, setSalary] = useState({ employee_id: '', salary_month: month, status: 'Pending', notes: '' });

  async function loadEmployees() {
    const data = await api('/api/employees');
    setEmployees(data.employees);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  async function saveEmployee(event) {
    event.preventDefault();
    await api(editingId ? `/api/employees/${editingId}` : '/api/employees', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify({ ...form, base_salary: Number(form.base_salary) })
    });
    setNotice(editingId ? 'Employee updated' : 'Employee added');
    setEditingId('');
    setForm({ ...form, name: '', mobile: '', address: '', aadhaar: '', designation: '', base_salary: 0 });
    await loadEmployees();
  }

  function editEmployee(employee) {
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      mobile: employee.mobile,
      address: employee.address || '',
      aadhaar: employee.aadhaar || '',
      joining_date: employee.joining_date?.slice(0, 10) || today,
      designation: employee.designation || '',
      salary_type: employee.salary_type,
      base_salary: employee.base_salary,
      active: employee.active
    });
  }

  async function deleteEmployee(employeeId) {
    await api(`/api/employees/${employeeId}`, { method: 'DELETE' });
    setNotice('Employee deactivated');
    await loadEmployees();
  }

  async function markAttendance(event) {
    event.preventDefault();
    await api('/api/employees/attendance', { method: 'POST', body: JSON.stringify(attendance) });
    setNotice('Attendance saved');
  }

  async function addAdvance(event) {
    event.preventDefault();
    await api('/api/employees/advances', { method: 'POST', body: JSON.stringify({ ...advance, amount: Number(advance.amount) }) });
    setNotice('Advance added');
    setAdvance({ ...advance, amount: '', reason: '' });
    await loadEmployees();
  }

  async function calculateSalary(event) {
    event.preventDefault();
    const result = await api('/api/employees/salaries/calculate', { method: 'POST', body: JSON.stringify(salary) });
    setNotice(`Salary calculated: ${formatMoney(result.salary.net_salary)}`);
    await loadEmployees();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader"><h2>{editingId ? 'Edit Employee' : 'Employee Profile'}</h2></div>
        <form className="formGrid fourCols" onSubmit={saveEmployee}>
          <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Mobile<input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} required /></label>
          <label>Aadhaar<input value={form.aadhaar} onChange={(event) => setForm({ ...form, aadhaar: event.target.value })} /></label>
          <label>Joining Date<input type="date" value={form.joining_date} onChange={(event) => setForm({ ...form, joining_date: event.target.value })} /></label>
          <label>Designation<input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
          <label>Salary Type<select value={form.salary_type} onChange={(event) => setForm({ ...form, salary_type: event.target.value })}>{['Monthly', 'Daily', 'Hourly'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Base Salary<input type="number" min="0" value={form.base_salary} onChange={(event) => setForm({ ...form, base_salary: event.target.value })} /></label>
          <label className="spanTwo">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <button className="primaryButton" type="submit"><Save size={18} />{editingId ? 'Save Employee' : 'Add Employee'}</button>
          {editingId && <button className="secondaryButton" type="button" onClick={() => { setEditingId(''); setForm({ name: '', mobile: '', address: '', aadhaar: '', joining_date: today, designation: '', salary_type: 'Monthly', base_salary: 0, active: true }); }}><X size={18} />Cancel</button>}
        </form>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Attendance, Advance & Salary</h2></div>
        <div className="tripleGrid">
          <form className="formGrid singleCol" onSubmit={markAttendance}>
            <label>Employee<SelectEmployee employees={employees} value={attendance.employee_id} onChange={(employee_id) => setAttendance({ ...attendance, employee_id })} /></label>
            <label>Date<input type="date" value={attendance.attendance_date} onChange={(event) => setAttendance({ ...attendance, attendance_date: event.target.value })} /></label>
            <label>Status<select value={attendance.status} onChange={(event) => setAttendance({ ...attendance, status: event.target.value })}>{['Present', 'Absent', 'Half Day', 'Leave'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="secondaryButton" type="submit">Save Attendance</button>
          </form>
          <form className="formGrid singleCol" onSubmit={addAdvance}>
            <label>Employee<SelectEmployee employees={employees} value={advance.employee_id} onChange={(employee_id) => setAdvance({ ...advance, employee_id })} /></label>
            <label>Date<input type="date" value={advance.advance_date} onChange={(event) => setAdvance({ ...advance, advance_date: event.target.value })} /></label>
            <label>Advance Given<input type="number" min="1" value={advance.amount} onChange={(event) => setAdvance({ ...advance, amount: event.target.value })} /></label>
            <label>Reason<input value={advance.reason} onChange={(event) => setAdvance({ ...advance, reason: event.target.value })} /></label>
            <button className="secondaryButton" type="submit">Add Advance</button>
          </form>
          <form className="formGrid singleCol" onSubmit={calculateSalary}>
            <label>Employee<SelectEmployee employees={employees} value={salary.employee_id} onChange={(employee_id) => setSalary({ ...salary, employee_id })} /></label>
            <label>Month<input type="month" value={salary.salary_month} onChange={(event) => setSalary({ ...salary, salary_month: event.target.value })} /></label>
            <label>Status<select value={salary.status} onChange={(event) => setSalary({ ...salary, status: event.target.value })}><option>Pending</option><option>Paid</option></select></label>
            <button className="secondaryButton" type="submit">Calculate Salary</button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Employees</h2></div>
        {employees.length ? (
          <div className="tableWrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Designation</th><th>Salary Type</th><th className="amountCell">Base</th><th className="amountCell">Advance Balance</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.employee_code}</td><td>{employee.name}</td><td>{employee.mobile}</td><td>{employee.designation}</td><td>{employee.salary_type}</td>
                  <td className="amountCell">{formatMoney(employee.base_salary)}</td>
                  <td className="amountCell">{formatMoney(employee.advance_balance)}</td>
                  <td><StatusBadge status={employee.active ? 'Active' : 'Inactive'} /></td>
                  <td><div className="tableActions"><button className="iconButton small" title="Edit employee" type="button" onClick={() => editEmployee(employee)}><Pencil size={16} /></button><button className="iconButton small" title="Deactivate employee" type="button" onClick={() => deleteEmployee(employee.id)}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No employees found" />}
      </section>
    </div>
  );
}

function SelectEmployee({ employees, value, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Select employee</option>
      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} - {employee.name}</option>)}
    </select>
  );
}
