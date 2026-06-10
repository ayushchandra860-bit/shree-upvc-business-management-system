import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { api, formatDate } from '../api';
import EmptyState from '../components/EmptyState.jsx';

export default function BackupRestore({ setNotice }) {
  const [history, setHistory] = useState([]);
  const [lastBackup, setLastBackup] = useState(null);
  const [restoreText, setRestoreText] = useState('');
  const [autoBackup, setAutoBackup] = useState('Daily');

  async function loadHistory() {
    const data = await api('/api/backups/history');
    setHistory(data.history);
    setLastBackup(data.lastBackup);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function restore() {
    await api('/api/backups/restore', { method: 'POST', body: restoreText });
    setRestoreText('');
    setNotice('Backup restored');
    await loadHistory();
  }

  return (
    <div className="pageStack">
      <section className="panel">
        <div className="sectionHeader"><h2>Backup & Restore</h2></div>
        <div className="buttonRow">
          <a className="primaryButton" href="/api/backups/export/json"><Download size={18} />Export JSON</a>
          <a className="secondaryButton" href="/api/backups/export/zip"><Download size={18} />Export ZIP</a>
          <a className="secondaryButton" href="/api/backups/export/excel"><Download size={18} />Export Excel</a>
        </div>
        <div className="formGrid backupOptions">
          <label>Auto Backup<select value={autoBackup} onChange={(event) => setAutoBackup(event.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>
          <label>Last Backup<input value={lastBackup ? formatDate(lastBackup.created_at) : 'No backup yet'} readOnly /></label>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Restore Backup</h2></div>
        <label className="fullLabel">
          Upload Backup File
          <textarea value={restoreText} onChange={(event) => setRestoreText(event.target.value)} placeholder="Paste exported JSON backup here" />
        </label>
        <button className="primaryButton" type="button" onClick={restore} disabled={!restoreText.trim()}><Upload size={18} />Restore All Data</button>
      </section>

      <section className="panel">
        <div className="sectionHeader"><h2>Backup History</h2></div>
        {history.length ? (
          <div className="tableWrap"><table><thead><tr><th>Date</th><th>Type</th><th>Format</th><th>Status</th><th>File</th></tr></thead><tbody>{history.map((item) => (
            <tr key={item.id}><td>{formatDate(item.created_at)}</td><td>{item.backup_type}</td><td>{item.export_format}</td><td>{item.status}</td><td>{item.file_name}</td></tr>
          ))}</tbody></table></div>
        ) : <EmptyState title="No backup history" />}
      </section>
    </div>
  );
}
