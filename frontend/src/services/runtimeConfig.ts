const productionBackendUrl = 'https://driftboard-api-q452.onrender.com';

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return import.meta.env.PROD ? `${productionBackendUrl}/api` : '/api';
}

export function getSocketBaseUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL;
  if (configured) return configured.replace(/\/$/, '');
  return import.meta.env.PROD ? productionBackendUrl : window.location.origin;
}
