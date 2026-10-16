import axios from 'axios';

const localhostOrigins = ['localhost', '127.0.0.1'];

const buildCandidateBases = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) {
    return [envBase.replace(/\/+$/, '')];
  }

  if (typeof window === 'undefined') {
    return ['http://127.0.0.1:7001/api', 'http://127.0.0.1:7002/api'];
  }

  const hostname = window.location.hostname;
  const localCandidates = localhostOrigins.includes(hostname)
    ? [`http://${hostname}:7001/api`, `http://${hostname}:7002/api`, 'http://localhost:7001/api', 'http://localhost:7002/api']
    : [`${window.location.origin.replace(/\/+$/, '')}/api`];

  return [...new Set(localCandidates.map((base) => base.replace(/\/+$/, '')))];
};

const candidateBases = buildCandidateBases();
let activeBase = candidateBases[0];

const isRetryableError = (error) => {
  if (!error.response) {
    return true;
  }

  return [404, 502, 503, 504].includes(error.response.status);
};

export const getApiBaseUrl = () => activeBase;

export const buildStreamUrl = (relativePath, params = {}) => {
  const base = `${activeBase.replace(/\/+$/, '')}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

export const getSocketBaseUrl = () => {
  const base = activeBase.replace(/\/api\/?$/, '');
  return base;
};

export const requestApi = async (config) => {
  let lastError;
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('unifix_token') : null;
  const baseHeaders = {
    ...(config.headers || {}),
  };

  if (token && !baseHeaders.Authorization) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }

  for (const baseURL of [activeBase, ...candidateBases.filter((candidate) => candidate !== activeBase)]) {
    try {
      const response = await axios({
        baseURL,
        headers: baseHeaders,
        ...config,
      });

      activeBase = baseURL;
      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};
