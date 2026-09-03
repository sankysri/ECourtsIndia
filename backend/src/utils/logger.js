const formatTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message, meta = {}) => {
    console.log(`[${formatTimestamp()}] [INFO] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  warn: (message, meta = {}) => {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  error: (message, error = null, meta = {}) => {
    console.error(
      `[${formatTimestamp()}] [ERROR] ${message}`,
      error?.stack || error?.message || error || '',
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    );
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${formatTimestamp()}] [DEBUG] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  },
};
