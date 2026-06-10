import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <section className="loginPanel">
        <div className="loginBrand">
          <div className="brandMark large">SU</div>
          <div>
            <h1>SHREE UPVC WINDOWS & DOORS</h1>
            <p>Admin Business Management System</p>
          </div>
        </div>

        <form className="formGrid" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="errorText"><LockKeyhole size={15} />{error}</div>}
          <button className="primaryButton" type="submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Signing in' : 'Secure Admin Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
