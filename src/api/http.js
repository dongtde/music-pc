import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 12000,
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
  try {
    return window.localStorage.getItem('mappic:netease-cookie') || '';
  } catch {
    return '';
  }
}

export default http;
