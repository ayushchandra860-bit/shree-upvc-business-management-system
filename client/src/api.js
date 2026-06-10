const API_BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed');
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }

  return data;
}

export function pdfUrl(id) {
  return `${API_BASE}/api/invoices/${id}/pdf`;
}

export function quotationPdfUrl(id) {
  return `${API_BASE}/api/quotations/${id}/pdf`;
}

export function receiptUrl(id) {
  return `${API_BASE}/api/payments/${id}/receipt`;
}

export function whatsappUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  });
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
