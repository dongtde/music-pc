import axios from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '../config/app';
import { readStorage } from '../utils/storage';

const http = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const cookie = getStoredCookie();

  if (cookie && !config.params?.cookie && !config.params?.noCookie) {
    config.params = {
      ...(config.params ?? {}),
      cookie,
    };
  }

  return config;
});

http.interceptors.response.use(
  (response) => {
    const data = response.data;
    const acceptCodes = response.config.acceptCodes ?? [200];

    if (data?.code && !acceptCodes.includes(data.code)) {
      return Promise.reject(
        new Error(
          data.message ?? `Netease API responded with code ${data.code}`,
        ),
      );
    }

    return data;
  },
  (error) => Promise.reject(error),
);

function getStoredCookie() {
  return readStorage(STORAGE_KEYS.neteaseCookie, '');
}

export default http;
