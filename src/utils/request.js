const axios = require('axios');

// create an axios instance
const service = axios.create({
    timeout: 60 * 1000 // request timeout
});

// request interceptor
service.interceptors.request.use(
    config => {
        // do something before request is sent
        return config;
    },
    error => {
        // do something with request error
        return Promise.reject(error);
    }
);

// response interceptor
service.interceptors.response.use(
    response => {
       return response;
    },
    error => {
        return Promise.reject(error);
    }
);

exports.service = service;
