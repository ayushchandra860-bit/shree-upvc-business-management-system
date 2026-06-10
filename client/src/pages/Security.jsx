import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { api, formatDate } from '../api';

export default function Security({ setNotice }) {
  const [admins, setAdmins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '', role: 'Admin' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });

  async function loadSecurity() {
    const [adminData, auditData, loginData] = await Promise.all([
      api('/api/security/admins'),
      api('/api/security/audit-logs'),
      api('/api/security/login-history')
    ]);
    setAdmins(adminData.admins);
    setLogs(auditData.logs);
    setHistory(loginData.history);
  }

  useEffect(() => {
    loadSecurity();
  }, []);

  async function createAdmin(event) {
    event.preventDefault();
    await api('/api/security/admins', { method: 'POST', body: JSON.stringify(adminForm) });
    setAdminForm({ name: '', email: '', password: '', role: 'Admin' });
    setNotice('Admin created');
    await loadSecurity();
  }

  async function changePassword(event) {
    event.preventDefault();
    await api('/api/security/change-password', { method: 'POST', body: JSON.stringify(passwordForm) });
    setPasswordForm({ current_password: '', new_password: '' });
    setNotice('Password changed');
  }

  async function deleteAdmin(id) {
    await api(`/api/security/admins/${id}`, { method: 'DELETE' });
    setNotice('Admin deactivated');
    await loadSecurity();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader"><h2>Admin Security</h2></div>
        <div className="splitGrid">
          <form className="formGrid singleCol" onSubmit={createAdmin}>
            <label>Name<input value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} required /></label>
            <label>Email<input type="email" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} required /></label>
            <label>Password<input type="password" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} required /></label>
            <button className="primaryButton" type="submit"><Save size={18} />Create Admin</button>
          </form>
          <form className="formGrid singleCol" onSubmit={changePassword}>
            <label>Current Password<input type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm({ ...passwordForm, current_password: event.target.value })} required /></label>
            <label>New Password<input type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })} required /></label>
            <button className="secondaryButton" type="submit">Change Admin Password</button>
          </form>
        </div>
      </section>

      <section className="panel"><div className="sectionHeader"><h2>Admins</h2></div><div className="tableWrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{admins.map((admin) => (
        <tr key={admin.id}><td>{admin.name}</td><td>{admin.email}</td><td>{admin.role}</td><td>{admin.active ? 'Active' : 'Inactive'}</td><td><button className="iconButton small" type="button" title="Delete admin" onClick={() => deleteAdmin(admin.id)}><Trash2 size={16} /></button></td></tr>
      ))}</tbody></table></div></section>

      <section className="panel"><div className="sectionHeader"><h2>Audit Logs</h2></div><div className="tableWrap"><table><thead><tr><th>Date</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead><tbody>{logs.map((log) => (
        <tr key={log.id}><td>{formatDate(log.created_at)}</td><td>{log.admin_name || log.admin_email}</td><td>{log.action}</td><td>{log.entity_type}</td></tr>
      ))}</tbody></table></div></section>

      <section className="panel"><div className="sectionHeader"><h2>Login History</h2></div><div className="tableWrap"><table><thead><tr><th>Date</th><th>Email</th><th>Status</th><th>IP</th></tr></thead><tbody>{history.map((item) => (
        <tr key={item.id}><td>{formatDate(item.created_at)}</td><td>{item.email}</td><td>{item.success ? 'Success' : 'Failed'}</td><td>{item.ip_address}</td></tr>
      ))}</tbody></table></div></section>
    </div>
  );
}
