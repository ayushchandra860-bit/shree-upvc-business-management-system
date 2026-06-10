import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../api';

const defaultSettings = {
  company_name: 'SHREE UPVC WINDOWS & DOORS',
  logo_url: '',
  gst_number: '',
  address: 'Baba Market, Lekha Nagar, Danapur, Patna - 801105, Bihar',
  mobile_number: '',
  email: '',
  bank_details: '',
  qr_code_url: '',
  signature_url: '',
  bank_name: '',
  account_number: '',
  ifsc: '',
  upi_id: '',
  terms_conditions: '',
  authorized_signature: 'Authorized Signatory',
  theme_mode: 'light',
  primary_color: '#0b2d5c',
  sidebar_color: '#0b2d5c'
};

export default function SettingsPage({ setNotice }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/settings')
      .then((data) => setSettings({ ...defaultSettings, ...(data.settings || {}) }))
      .catch(() => setSettings(defaultSettings))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--blue', settings.primary_color || '#0b2d5c');
    document.documentElement.style.setProperty('--sidebar', settings.sidebar_color || '#0b2d5c');
    document.body.dataset.theme = settings.theme_mode || 'light';
  }, [settings.primary_color, settings.sidebar_color, settings.theme_mode]);

  async function submit(event) {
    event.preventDefault();
    const data = await api('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
    setSettings(data.settings);
    setNotice('Settings updated');
  }

  function uploadImage(field, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSettings((current) => ({ ...current, [field]: reader.result }));
    reader.readAsDataURL(file);
  }

  if (loading) return <section className="panel">Loading settings</section>;

  return (
    <section className="panel">
      <div className="sectionHeader"><h2>Company Settings</h2></div>
      <form className="formGrid fourCols" onSubmit={submit}>
        <label className="spanTwo">Company Name<input value={settings.company_name} onChange={(event) => setSettings({ ...settings, company_name: event.target.value })} /></label>
        <label>GST Number<input value={settings.gst_number} onChange={(event) => setSettings({ ...settings, gst_number: event.target.value })} /></label>
        <label>Mobile Number<input value={settings.mobile_number} onChange={(event) => setSettings({ ...settings, mobile_number: event.target.value })} /></label>
        <label>Email<input value={settings.email} onChange={(event) => setSettings({ ...settings, email: event.target.value })} /></label>
        <label>Logo Upload<input type="file" accept="image/*" onChange={(event) => uploadImage('logo_url', event.target.files?.[0])} /></label>
        <label>Signature Upload<input type="file" accept="image/*" onChange={(event) => uploadImage('signature_url', event.target.files?.[0])} /></label>
        <label>QR Upload<input type="file" accept="image/*" onChange={(event) => uploadImage('qr_code_url', event.target.files?.[0])} /></label>
        <label>Bank Name<input value={settings.bank_name} onChange={(event) => setSettings({ ...settings, bank_name: event.target.value })} /></label>
        <label>Account Number<input value={settings.account_number} onChange={(event) => setSettings({ ...settings, account_number: event.target.value })} /></label>
        <label>IFSC<input value={settings.ifsc} onChange={(event) => setSettings({ ...settings, ifsc: event.target.value })} /></label>
        <label>UPI ID<input value={settings.upi_id} onChange={(event) => setSettings({ ...settings, upi_id: event.target.value })} /></label>
        <label>Theme Mode<select value={settings.theme_mode} onChange={(event) => setSettings({ ...settings, theme_mode: event.target.value })}><option value="light">Light Mode</option><option value="dark">Dark Mode</option></select></label>
        <label>Primary Color<input type="color" value={settings.primary_color} onChange={(event) => setSettings({ ...settings, primary_color: event.target.value })} /></label>
        <label>Sidebar Color<input type="color" value={settings.sidebar_color} onChange={(event) => setSettings({ ...settings, sidebar_color: event.target.value })} /></label>
        <label className="spanTwo">Full Address<textarea value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label>
        <label className="spanTwo">Bank Details<textarea value={settings.bank_details} onChange={(event) => setSettings({ ...settings, bank_details: event.target.value })} /></label>
        <label className="spanTwo">Terms & Conditions<textarea value={settings.terms_conditions} onChange={(event) => setSettings({ ...settings, terms_conditions: event.target.value })} /></label>
        <label>Authorized Signature<input value={settings.authorized_signature} onChange={(event) => setSettings({ ...settings, authorized_signature: event.target.value })} /></label>
        <button className="primaryButton" type="submit"><Save size={18} />Save Settings</button>
      </form>
    </section>
  );
}
