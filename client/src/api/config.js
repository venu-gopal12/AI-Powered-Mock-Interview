const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

// Production builds must point at an explicit HTTPS API. Local development can
// fall back to the Express server's default port.
if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error(
    'VITE_API_URL is required in production. Set it to the public HTTPS URL of the API.'
  );
}

// Strip trailing slashes so endpoint paths concatenate consistently.
export const API_URL = (configuredApiUrl || 'http://localhost:5000').replace(/\/+$/, '');
