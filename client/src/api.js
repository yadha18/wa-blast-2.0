import axios from 'axios';
import { io } from 'socket.io-client';

// In local dev this stays empty and Vite's proxy (see vite.config.js) forwards
// /api and /socket.io to the backend on :4000. In production — when frontend
// and backend are deployed as separate Railway services — set VITE_BACKEND_URL
// at build time to the backend's public URL, e.g. https://wa-blast-server.up.railway.app
// Trailing slash is stripped defensively — a value like ".../app/" would
// otherwise produce double slashes in every request path.
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

// eslint-disable-next-line no-console
console.log('[Config] Menghubungi backend di:', BACKEND_URL || '(relatif — proxy dev lokal)');

export const api = axios.create({ baseURL: `${BACKEND_URL}/api`, timeout: 30000 });

// WebSocket first avoids the long-polling handshake problems that commonly
// break Socket.io behind proxies; polling stays as a fallback.
export const socket = io(BACKEND_URL || '/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
});

// Banner images are returned by the backend as relative paths (/uploads/...);
// prefix them with the backend origin so they resolve correctly when the
// frontend is hosted on a different domain than the backend.
export function assetUrl(relativePath) {
  if (!relativePath) return relativePath;
  return `${BACKEND_URL}${relativePath}`;
}

export async function fetchWaStatus() {
  const { data } = await api.get('/wa/status');
  return data;
}

export async function logoutWa() {
  const { data } = await api.post('/wa/logout');
  return data;
}

export async function uploadContacts(file, name, message) {
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);
  form.append('message', message);
  // Do NOT set Content-Type manually here — the browser must generate the
  // multipart boundary itself when sending a FormData body. Setting
  // 'multipart/form-data' explicitly (without a boundary) breaks parsing on
  // the server, sometimes silently.
  const { data } = await api.post('/upload', form);
  return data;
}

export async function uploadBanner(campaignId, file) {
  const form = new FormData();
  form.append('banner', file);
  const { data } = await api.post(`/campaigns/${campaignId}/banner`, form);
  return data;
}

export async function removeBanner(campaignId) {
  const { data } = await api.delete(`/campaigns/${campaignId}/banner`);
  return data;
}

export async function startCampaign(campaignId, message, delayMs) {
  const { data } = await api.post(`/campaigns/${campaignId}/send`, { message, delayMs });
  return data;
}

export async function pauseCampaign(campaignId) {
  const { data } = await api.post(`/campaigns/${campaignId}/pause`);
  return data;
}

export async function resumeCampaign(campaignId) {
  const { data } = await api.post(`/campaigns/${campaignId}/resume`);
  return data;
}

export async function stopCampaign(campaignId) {
  const { data } = await api.post(`/campaigns/${campaignId}/stop`);
  return data;
}

export async function fetchCampaign(campaignId) {
  const { data } = await api.get(`/campaigns/${campaignId}`);
  return data;
}

export async function fetchContacts(campaignId, status, page = 1) {
  const { data } = await api.get(`/campaigns/${campaignId}/contacts`, {
    params: { status, page, pageSize: 100 },
  });
  return data;
}
