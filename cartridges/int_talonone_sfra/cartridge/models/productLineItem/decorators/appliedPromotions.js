'use strict';

var collections = require('*/cartridge/scripts/util/collections');
var Resource = require('dw/web/Resource');

/**
 * get the talonone promotions applied to the product line item
 * @param {dw.order.ProductLineItem} lineItem - API ProductLineItem instance
 * @returns {Object[]|undefined} an array of objects containing the promotions applied to the
 *                               product line item.
 */
function getAppliedPromotions(lineItem) {
    var priceAdjustments;

    if (lineItem.priceAdjustments.getLength() > 0) {
        priceAdjustments = collections.map(lineItem.priceAdjustments, function (priceAdjustment) {
            // Talonone - Begin: Updating the talonone promotion callout message with respect to talonone response effect
            var TalonOnePreferences = require('*/cartridge/scripts/util/talonOnePreferences');
            if (TalonOnePreferences.isEnabled() && priceAdjustment.custom.talonOnePromotionRuleName) {
                return {
                    callOutMsg: priceAdjustment.custom.talonOnePromotionRuleName ?
                        priceAdjustment.custom.talonOnePromotionRuleName : ''
                };
            }
            // Talonone - End: Updating the talonone promotion callout message with respect to talonone response effect

            if (priceAdjustment.promotion) {
                return {
                    callOutMsg: priceAdjustment.promotion.calloutMsg ?
                        priceAdjustment.promotion.calloutMsg.markup : '',
                    name: priceAdjustment.promotion.name,
                    details: priceAdjustment.promotion.details ?
                        priceAdjustment.promotion.details.markup : ''
                };
            }
            return {
                callOutMsg: Resource.msg('label.genericDiscount', 'common', null)
            };
        });
    }

    return priceAdjustments;
}

module.exports = function (object, lineItem) {
    Object.defineProperty(object, 'appliedPromotions', {
        enumerable: true,
        value: getAppliedPromotions(lineItem)
    });
};
