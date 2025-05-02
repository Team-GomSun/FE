import ky from 'ky';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const apiClient = ky.extend({
  prefixUrl: API_URL,
  timeout: 10000,
  retry: {
    limit: 2,
    methods: ['get', 'post', 'put', 'delete', 'patch'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        request.headers.set('Content-Type', 'application/json');
      },
    ],
    afterResponse: [
      (_request, _options, response) => {
        return response;
      },
    ],
    beforeError: [
      (error) => {
        const { response } = error;
        if (response) {
          console.error(`API 오류: ${response.status} - ${response.statusText}`);
        }
        return error;
      },
    ],
  },
});
