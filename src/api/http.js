import axios from 'axios';
import { API_CONFIG } from '../config/app';

const http = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  if (config.params?.noCookie !== undefined) {
    const { noCookie, ...params } = config.params;
    config.params = params;
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

export default http;
