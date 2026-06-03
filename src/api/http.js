import axios from 'axios'

const http = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 12000
})

http.interceptors.response.use(
  (response) => {
    const data = response.data

    if (data?.code && data.code !== 200) {
      return Promise.reject(new Error(data.message ?? `Netease API responded with code ${data.code}`))
    }

    return data
  },
  (error) => Promise.reject(error)
)

export default http
