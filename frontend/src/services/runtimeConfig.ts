export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return '/api';
}

export function getSocketBaseUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL;
  if (configured) return configured.replace(/\/$/, '');
  return window.location.origin;
}
