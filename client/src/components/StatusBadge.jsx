export default function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase().replaceAll(' ', '-');
  return <span className={`statusBadge ${key}`}>{status || '-'}</span>;
}
