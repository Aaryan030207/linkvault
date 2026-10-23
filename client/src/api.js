
const API_BASE = `${import.meta.env.VITE_API_BASE || 'https://linkvault-vlx5.onrender.com'}/api/url`;

export async function shortenUrl(data) {
  const response = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Failed to shorten URL');
  }

  return result;
}

export async function fetchLinks() {
  const response = await fetch(`${API_BASE}/links`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Failed to fetch links');
  }

  return result.data || [];
}

export async function fetchStats() {
  const response = await fetch(`${API_BASE}/stats`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Failed to fetch stats');
  }

  return result.data;
}

export async function deleteLink(code) {
  const response = await fetch(`${API_BASE}/${code}`, {
    method: 'DELETE'
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Failed to delete link');
  }

  return result;
}

export async function checkServerHealth() {
  try {
    const res = await fetch(
      'https://linkvault-vlx5.onrender.com/api/health'
    );

    const data = await res.json();

    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
