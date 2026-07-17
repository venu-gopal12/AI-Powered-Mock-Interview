function createRateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  // In-memory limits are enough for local/single-process deployments. A shared
  // store would be needed if this server were horizontally scaled.
  const clients = new Map();

  return (req, res, next) => {
    const now = Date.now();
    // Combine IP and anonymous browser session so one shared network does not
    // immediately collapse all users into the same bucket.
    const key = `${req.ip}:${req.get('X-Session-ID') || 'anonymous'}`;
    const current = clients.get(key);
    const record =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;
    record.count += 1;
    clients.set(key, record);

    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - record.count)));
    if (record.count > max) {
      res.set('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }
    if (clients.size > 10_000) {
      // Opportunistic cleanup prevents the map from growing forever on long
      // running development servers.
      for (const [clientKey, value] of clients) {
        if (value.resetAt <= now) clients.delete(clientKey);
      }
    }
    return next();
  };
}

module.exports = { createRateLimiter };
