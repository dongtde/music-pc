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
  const skipCookie = Boolean(config.noCookie || config.params?.noCookie);

  if (config.params?.noCookie) {
    const { noCookie, ...params } = config.params;
    config.params = params;
  }

  if (cookie && !config.params?.cookie && !skipCookie) {
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
    const acceptCodes = response.config.acceptCodes;
    const responseCode = data?.code;
    const errorCode = data?.error_code ?? data?.errcode ?? data?.err_code;

    if (acceptCodes && responseCode !== undefined && responseCode !== null && !acceptCodes.includes(responseCode)) {
      return Promise.reject(
        new Error(
          data.message ?? data.errmsg ?? `KuGouMusic API responded with code ${responseCode}`,
        ),
      );
    }

    const normalizedErrorCode = Number(errorCode);

    if (
      errorCode !== undefined &&
      errorCode !== null &&
      Number.isFinite(normalizedErrorCode) &&
      normalizedErrorCode !== 0 &&
      normalizedErrorCode !== 200
    ) {
      return Promise.reject(
        new Error(
          data.message ?? data.error_msg ?? data.errmsg ?? `KuGouMusic API responded with error ${errorCode}`,
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
