const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error(
    'VITE_API_URL is required in production. Set it to the public HTTPS URL of the API.'
  );
}

export const API_URL = (configuredApiUrl || 'http://localhost:5000').replace(/\/+$/, '');
