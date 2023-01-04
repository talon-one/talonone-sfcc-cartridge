'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var serviceName = 'talonone.http.service';

var talonOneService = LocalServiceRegistry.createService(serviceName, {
    createRequest: function (svc, params) {
        svc.setRequestMethod(params.method);
        svc.addHeader('Content-Type', 'application/json');

        svc.addHeader('Authorization', params.auth);
        svc.setURL(svc.getConfiguration().credential.URL + '/' + params.url);

        return JSON.stringify(params.body);
    },
    parseResponse: function (svc, response) {
        return response;
    },
    getRequestLogMessage: function (request) {
        return request;
    },
    getResponseLogMessage: function (response) {
        return response.text;
    }
});

module.exports = talonOneService;
