import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
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

const themePresets = {
  corporate: {
    id: 'corporate',
    label: 'Corporate Blue',
    description: 'Bright and clean with the strongest brand fit for daily operations.',
    theme_mode: 'light',
    primary_color: '#0b2d5c',
    secondary_color: '#143e78',
    sidebar_color: '#0b2d5c',
    swatches: ['#0b2d5c', '#143e78', '#eef2f6']
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite Night',
    description: 'Sharper dark workspace with cooler contrast for long admin sessions.',
    theme_mode: 'dark',
    primary_color: '#60a5fa',
    secondary_color: '#3b82f6',
    sidebar_color: '#111827',
    swatches: ['#111827', '#60a5fa', '#1f2937']
  },
  steel: {
    id: 'steel',
    label: 'Steel Slate',
    description: 'Neutral professional tone with a softer industrial presentation.',
    theme_mode: 'light',
    primary_color: '#24415d',
    secondary_color: '#365a7c',
    sidebar_color: '#1e344a',
    swatches: ['#24415d', '#365a7c', '#f3f6fa']
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight Cyan',
    description: 'A dark premium theme with crisp highlights for key actions and values.',
    theme_mode: 'dark',
    primary_color: '#38bdf8',
    secondary_color: '#0ea5e9',
    sidebar_color: '#0f172a',
    swatches: ['#0f172a', '#38bdf8', '#1e293b']
  }
};

function detectPreset(settings) {
  return Object.values(themePresets).find((preset) => (
    preset.theme_mode === (settings.theme_mode || 'light')
    && preset.primary_color.toLowerCase() === String(settings.primary_color || '').toLowerCase()
    && preset.sidebar_color.toLowerCase() === String(settings.sidebar_color || '').toLowerCase()
  ))?.id || 'corporate';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image'));
    image.src = dataUrl;
  });
}

const assetProfiles = {
  logo_url: {
    maxWidth: 640,
    maxHeight: 320,
    preferredType: 'image/png',
    fallbackType: 'image/jpeg',
    quality: 0.84,
    maxChars: 1200000
  },
  signature_url: {
    maxWidth: 900,
    maxHeight: 260,
    preferredType: 'image/png',
    fallbackType: 'image/jpeg',
    quality: 0.8,
    maxChars: 900000
  },
  qr_code_url: {
    maxWidth: 600,
    maxHeight: 600,
    preferredType: 'image/png',
    fallbackType: 'image/png',
    quality: 0.92,
    maxChars: 900000
  }
};

async function optimizeUploadImage(field, file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.type === 'image/svg+xml') {
    return originalDataUrl;
  }

  const profile = assetProfiles[field] || assetProfiles.logo_url;
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(
    1,
    profile.maxWidth / Math.max(image.width, 1),
    profile.maxHeight / Math.max(image.height, 1)
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return originalDataUrl;
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let output = canvas.toDataURL(profile.preferredType, profile.quality);

  if (output.length > profile.maxChars && profile.fallbackType !== profile.preferredType) {
    let quality = profile.quality;
    output = canvas.toDataURL(profile.fallbackType, quality);

    while (output.length > profile.maxChars && quality > 0.55) {
      quality -= 0.08;
      output = canvas.toDataURL(profile.fallbackType, quality);
    }
  }

  return output;
}

export default function SettingsPage({ setNotice }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('corporate');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/settings')
      .then((data) => {
        const merged = { ...defaultSettings, ...(data.settings || {}) };
        setSettings(merged);
        setSelectedTheme(detectPreset(merged));
      })
      .catch(() => {
        setSettings(defaultSettings);
        setSelectedTheme('corporate');
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTheme = themePresets[selectedTheme] || themePresets.corporate;

  useEffect(() => {
    document.documentElement.style.setProperty('--blue', settings.primary_color || activeTheme.primary_color);
    document.documentElement.style.setProperty('--blue-2', activeTheme.secondary_color);
    document.documentElement.style.setProperty('--sidebar', settings.sidebar_color || activeTheme.sidebar_color);
    document.body.dataset.theme = settings.theme_mode || activeTheme.theme_mode;
  }, [activeTheme.primary_color, activeTheme.secondary_color, activeTheme.sidebar_color, settings.primary_color, settings.sidebar_color, settings.theme_mode]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const data = await api('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSettings(data.settings);
      setSelectedTheme(detectPreset(data.settings));
      setNotice('Settings updated');
    } catch (error) {
      const message = error.status === 413
        ? 'Image file is too large to save. Please use a smaller logo or signature image.'
        : error.message || 'Settings could not be saved';
      setNotice(message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(field, file) {
    if (!file) return;
    try {
      const imageData = await optimizeUploadImage(field, file);
      setSettings((current) => ({ ...current, [field]: imageData }));
    } catch {
      setNotice('Image could not be processed');
    }
  }

  function applyThemePreset(presetId) {
    const preset = themePresets[presetId];
    if (!preset) return;

    setSelectedTheme(presetId);
    setSettings((current) => ({
      ...current,
      theme_mode: preset.theme_mode,
      primary_color: preset.primary_color,
      sidebar_color: preset.sidebar_color
    }));
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
        <div className="uploadAssetBlock">
          <div className="formSectionHeader">
            <div>
              <h3>Brand Assets</h3>
              <p>Upload the company logo, signature and QR image. A preview appears immediately before saving.</p>
            </div>
          </div>
          <div className="uploadAssetGrid">
            <label className="uploadAssetCard">
              <span>Logo Upload</span>
              <input type="file" accept="image/*" onChange={(event) => uploadImage('logo_url', event.target.files?.[0])} />
              <div className="assetPreviewFrame">
                {settings.logo_url ? <img src={settings.logo_url} alt="Logo preview" className="assetPreviewImage" /> : <span className="assetPreviewEmpty">No logo selected</span>}
              </div>
            </label>
            <label className="uploadAssetCard">
              <span>Signature Upload</span>
              <input type="file" accept="image/*" onChange={(event) => uploadImage('signature_url', event.target.files?.[0])} />
              <div className="assetPreviewFrame">
                {settings.signature_url ? <img src={settings.signature_url} alt="Signature preview" className="assetPreviewImage contain" /> : <span className="assetPreviewEmpty">No signature selected</span>}
              </div>
            </label>
            <label className="uploadAssetCard">
              <span>QR Upload</span>
              <input type="file" accept="image/*" onChange={(event) => uploadImage('qr_code_url', event.target.files?.[0])} />
              <div className="assetPreviewFrame">
                {settings.qr_code_url ? <img src={settings.qr_code_url} alt="QR preview" className="assetPreviewImage contain" /> : <span className="assetPreviewEmpty">No QR selected</span>}
              </div>
            </label>
          </div>
        </div>
        <label>Bank Name<input value={settings.bank_name} onChange={(event) => setSettings({ ...settings, bank_name: event.target.value })} /></label>
        <label>Account Number<input value={settings.account_number} onChange={(event) => setSettings({ ...settings, account_number: event.target.value })} /></label>
        <label>IFSC<input value={settings.ifsc} onChange={(event) => setSettings({ ...settings, ifsc: event.target.value })} /></label>
        <label>UPI ID<input value={settings.upi_id} onChange={(event) => setSettings({ ...settings, upi_id: event.target.value })} /></label>
        <div className="themePresetBlock">
          <div className="formSectionHeader">
            <div>
              <h3>Theme Presets</h3>
              <p>Choose from curated interface themes instead of changing colors manually.</p>
            </div>
          </div>
          <div className="themePresetGrid">
            {Object.values(themePresets).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`themePresetCard ${selectedTheme === preset.id ? 'active' : ''}`}
                onClick={() => applyThemePreset(preset.id)}
              >
                <div className="themePresetTop">
                  <div>
                    <strong>{preset.label}</strong>
                    <span>{preset.theme_mode === 'dark' ? 'Dark workspace' : 'Light workspace'}</span>
                  </div>
                  {selectedTheme === preset.id && <Check size={18} />}
                </div>
                <div className="themeSwatches" aria-hidden="true">
                  {preset.swatches.map((swatch) => (
                    <span className="themeSwatch" key={swatch} style={{ background: swatch }} />
                  ))}
                </div>
                <p>{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
        <label className="spanTwo">Full Address<textarea value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label>
        <label className="spanTwo">Bank Details<textarea value={settings.bank_details} onChange={(event) => setSettings({ ...settings, bank_details: event.target.value })} /></label>
        <label className="spanTwo">Terms & Conditions<textarea value={settings.terms_conditions} onChange={(event) => setSettings({ ...settings, terms_conditions: event.target.value })} /></label>
        <label>Authorized Signature<input value={settings.authorized_signature} onChange={(event) => setSettings({ ...settings, authorized_signature: event.target.value })} /></label>
        <button className="primaryButton" type="submit" disabled={saving}><Save size={18} />{saving ? 'Saving...' : 'Save Settings'}</button>
      </form>
    </section>
  );
}
