/* eslint-disable */
'use strict';

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');

var TalonOneServiceWrapper = require('*/cartridge/scripts/util/talonOneServiceWrapper');
var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');

/**
 * @function calculateDiscounts
 *
 * calculateDiscounts is the arching logic for computing the value of a basket.  It makes
 * calls into talonone service and enables both SG and OCAPI applications to share
 * the same cart calculation logic.
 *
 * @param {object} basket The basket to be calculated
 */
exports.calculateDiscounts = function (basket) {
    var customerSessionData = TalonOneServiceWrapper.customer_sessions(basket, 'open');

    if (!customerSessionData.error) {
        var response = JSON.parse(customerSessionData.result.text);
        var lineItemPosition = talonOneHelper.getLineItemPosition(response.customerSession.cartItems);
        var discountEffects = talonOneHelper.getResponseEffects(response.effects);
        talonOneHelper.executeDiscountEffects(basket, discountEffects, lineItemPosition);
    }

    return new Status(Status.OK);
};