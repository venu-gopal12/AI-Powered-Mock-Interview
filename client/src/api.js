import axios from 'axios';
import { API_URL } from './config';

const api = axios.create({ baseURL: API_URL, timeout: 45_000 });

api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('interviewSessionId');
  if (sessionId) config.headers['X-Session-ID'] = sessionId;
  return config;
});

export default api;
