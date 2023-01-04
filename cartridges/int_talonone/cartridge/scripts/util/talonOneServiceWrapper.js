/* globals session */

'use strict';

var TalonOneUtils = require('~/cartridge/scripts/util/talonOneUtils');
var TalonOneService = require('~/cartridge/scripts/services/talonOneService');
var Result = require('dw/svc/Result');
var Resource = require('dw/web/Resource');
var Logger = require('dw/system/Logger').getLogger('talonone', 'talonone');

var TalonOneServiceWrapper = {

    customer_sessions: function (basket, state, couponCode) {
        try {
            var requestObject = TalonOneUtils.buildCreateCustomerSessionRequest(basket, state, couponCode);

            var response = TalonOneService.call(requestObject);

            if (response.status !== Result.OK) {
                Logger.error('Error on creation/updation of customer session ID: ' + requestObject.sessionId + '' + JSON.stringify(response));

                Logger.error('Talonone response error with error status: ' + response.status + ' & error message: ' + response.errorMessage);

                var errorMessage = Resource.msg('talonone.response.error.msg', 'talonOne', null);
                if (response.error === 400) {
                    var responseErrorMsg = JSON.parse(response.errorMessage);
                    if (responseErrorMsg.message === errorMessage) {
                        delete session.privacy.customerSessionID;
                        TalonOneServiceWrapper.customer_sessions(basket, 'open');
                    }
                }
                return {
                    error: true
                };
            }

            Logger.info('Successfully created/updated customer session of ID: ' + requestObject.sessionId);

            return {
                error: false,
                result: response.object
            };
        } catch (e) {
            Logger.error('Error in customer_sessions' + JSON.stringify(e));

            return {
                error: true
            };
        }
    },
    customerProfiles: function (profile) {
        try {
            var requestObject = TalonOneUtils.createCustomerProfilesRequest(profile);

            var response = TalonOneService.call(requestObject);

            if (response.status !== Result.OK) {
                Logger.error('Error on creation/updation of customer profile: ' + profile.UUID + '' + JSON.stringify(response));

                return {
                    error: true
                };
            }

            Logger.info('Successfully created/updated customer profile: ' + profile.UUID);

            return {
                error: false,
                result: response.object
            };
        } catch (e) {
            Logger.error('Error in customerProfiles' + JSON.stringify(e));

            return {
                error: true
            };
        }
    },
    createAttributes: function () {
        var requestObject = TalonOneUtils.createAttributesRequest();
        var response = TalonOneService.call(requestObject);
        var apiResponse = {};
        var responseObj = {};
        try {
            if (response.status !== Result.OK || response.error === 400) {
                Logger.error('Error on creation of custom attributes: ' + JSON.stringify(response));
                apiResponse = {
                    error: true,
                    result: response
                };
            } else {
                responseObj = JSON.parse(response.object.text).attributes;
                if (responseObj) {
                    Logger.info('Successfully created custom attributes: ' + JSON.stringify(response));
                } else {
                    Logger.info('Custom attributes already exist: ' + JSON.stringify(response));
                }

                apiResponse = {
                    error: false,
                    result: response.object
                };
            }
            return apiResponse;
        } catch (e) {
            Logger.error('Error in createAttributes' + JSON.stringify(e));
            return {
                error: true
            };
        }
    }
};

module.exports = TalonOneServiceWrapper;
