import axios from 'axios';
import { API_URL } from './config';

// One shared Axios instance keeps route code small and applies the same timeout
// to all backend requests.
const api = axios.create({ baseURL: API_URL, timeout: 45_000 });

api.interceptors.request.use((config) => {
  // The anonymous session id helps the backend rate limiter distinguish browser
  // sessions behind the same IP address.
  const sessionId = localStorage.getItem('interviewSessionId');
  if (sessionId) config.headers['X-Session-ID'] = sessionId;
  return config;
});

export default api;
