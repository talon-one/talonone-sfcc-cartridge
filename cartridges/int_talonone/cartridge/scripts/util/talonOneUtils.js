/* globals empty, session, customer */

'use strict';

var Site = require('dw/system/Site');
var talonOnePreferences = require('*/cartridge/scripts/util/talonOnePreferences');
var Logger = require('dw/system/Logger').getLogger('talonone', 'talonone');

/**
 * Generate a customersession ID from basketUUid or retrieve from session.
 * @param {dw.order.Basket} basket - Current user's basket
 * @return {string} customerSessionID value.
 */
function getSessionID(basket) {
    if (empty(session.privacy.customerSessionID)) {
        session.privacy.customerSessionID = basket.UUID;
    }
    Logger.info('Customer Session Id is : ' + session.privacy.customerSessionID);
    return session.privacy.customerSessionID;
}

/**
 * Generate profile ID from current customer number or create a new one or retrieve from session.
 * @return {string} customerProfileID value.
 */
function getProfileID() {
    var UUIDUtils = require('dw/util/UUIDUtils');

    if (!customer.authenticated) {
        if (empty(session.privacy.customerProfileID)) {
            session.privacy.customerProfileID = talonOnePreferences.getProfileUUIDPrefix() + UUIDUtils.createUUID();
        }
    } else {
        session.privacy.customerProfileID = talonOnePreferences.getProfileUUIDPrefix() + customer.getProfile().getCustomerNo();
    }
    Logger.info('Profile Session Id is : ' + session.privacy.customerProfileID);
    return session.privacy.customerProfileID;
}

/**
 * Returns the master product sku for each productline item.
 * @param {dw.order.LineItemCtnr} lineItem - Current user's basket lineitem
 * @return {string} master product sku.
 */
function getMasterProductID(lineItem) {
    var product = lineItem.product;

    if (product.isVariant()) {
        product = product.masterProduct;
    }

    if (product.isMaster()) {
        return product.ID;
    }

    return '';
}

/**
 * Returns the product category for each lineitem
 * @param {dw.order.LineItemCtnr} lineItem - Current user's basket lineitem
 * @return {string} category name.
 */
function getProductCategory(lineItem) {
    var product = lineItem.product;
    var onlineCategories;
    var catArray = [];

    if (product.isVariant()) {
        product = product.masterProduct;
    }

    onlineCategories = product.getOnlineCategories();

    var categoriesItr = onlineCategories.iterator();
    while (categoriesItr.hasNext()) {
        var category = categoriesItr.next();
        var displayName = category.ID;
        catArray.push(displayName);
    }

    return catArray;
}

/**
 * Returns the productInfo custom size attribute details that are configured
 * @param {dw.catalog.Product} apiProduct product object
 * @returns {string} the custom attribute value
 */
function getSize(apiProduct) {
    return apiProduct.custom.size ? apiProduct.custom.size : '';
}

/**
 * Returns the productInfo custom color attribute details that are configured
 * @param {dw.catalog.Product} apiProduct product object
 * @returns {string} the custom attribute value
 */
function getColor(apiProduct) {
    var productColor = '';
    var variantAttribute = apiProduct.getVariationModel().getProductVariationAttribute('color');
    if (variantAttribute != null) {
        try {
            if (apiProduct.getVariationModel().getSelectedValue(variantAttribute) != null) {
                productColor = apiProduct.getVariationModel().getSelectedValue(variantAttribute).getDisplayValue();
            }
        } catch (e) {
            Logger.error('Error on getting color attribute' + JSON.stringify(e));
        }
    }
    return productColor;
}

/**
 * Returns the productInfo custom attribute details that are configured
 * @param {dw.catalog.Product} apiProduct product object
 * @param {string} attribute product attribute key
 * @returns {string} the custom attribute value
 */
function getAttributeValue(apiProduct, attribute) {
    if (attribute.indexOf('custom.') !== -1) {
        if (Object.hasOwnProperty.call(apiProduct.custom, attribute) && apiProduct.custom[attribute]) {
            return apiProduct.custom[attribute].toString();
        }
    } else if (Object.hasOwnProperty.call(apiProduct, attribute) && apiProduct[attribute]) {
        return apiProduct[attribute].toString();
    }

    return null;
}

/**
 * Returns all the product attributes present for each lineitem
 * @param {dw.order.LineItemCtnr} lineItem - Current user's basket lineitem
 * @return {string} product attribute values.
 */
function getAttributes(lineItem) {
    var attributeJson = {};
    var attributeValues = talonOnePreferences.getAttributeValues();

    Object.keys(attributeValues).forEach(function (key) {
        if (attributeValues[key] === 'size') {
            attributeJson.size = getSize(lineItem.product);
        } else if (attributeValues[key] === 'color') {
            attributeJson.color = [getColor(lineItem.product)];
        } else {
            attributeJson.key = getAttributeValue(lineItem.product, attributeValues[key]);
        }
    });

    attributeJson.category = getProductCategory(lineItem) || [];
    attributeJson.itemPosition = lineItem.position;

    return attributeJson;
}

/**
 * Generate the cart item details needed for talonone request body.
 * @param {dw.order.Basket} basket - Current user's basket
 * @return {Object} cart item details.
 */
function getCartItems(basket) {
    var cartItems = [];

    var lineItemItr = basket.getProductLineItems().iterator();
    var productLineItem;
    var productObj;

    while (lineItemItr.hasNext()) {
        productLineItem = lineItemItr.next();

        if (productLineItem.custom.hasTalonOneFreeItem) {
            var productTotalQty = productLineItem.getQuantity().value;
            var lineItemPriceAdjustments = productLineItem.getPriceAdjustments().iterator();
            var lineItemPriceAdjustment;
            var freeItemQty = 0;
            while (lineItemPriceAdjustments.hasNext()) {
                lineItemPriceAdjustment = lineItemPriceAdjustments.next();
                freeItemQty += lineItemPriceAdjustment.custom.talonOneFreeItemQty;
            }

            var existingQtyInCart = productTotalQty - freeItemQty;
            if (existingQtyInCart > 0) {
                productObj = {
                    name: productLineItem.product.name,
                    sku: productLineItem.product.ID,
                    masterId: getMasterProductID(productLineItem) || '',
                    uuId: productLineItem.getUUID() || '',
                    quantity: existingQtyInCart,
                    price: productLineItem.getPriceValue() / productTotalQty,
                    attributes: getAttributes(productLineItem)
                };

                cartItems.push(productObj);
            }
        } else {
            productObj = {
                name: productLineItem.product.name,
                sku: productLineItem.product.ID,
                masterId: getMasterProductID(productLineItem) || '',
                uuId: productLineItem.getUUID() || '',
                quantity: productLineItem.quantity.value,
                price: productLineItem.getPriceValue() / productLineItem.quantity.value,
                attributes: getAttributes(productLineItem)
            };

            cartItems.push(productObj);
        }
    }

    return cartItems;
}

/**
 * Retrieve the coupon code which are available on basket.
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {string} couponCode - coupon code
 * @return {Array} the coupon codes present on basket
 */
function getCouponCodes(basket, couponCode) {
    var couponCodes = [];
    if (!empty(couponCode)) {
        couponCodes.push(couponCode);
        return couponCodes;
    }

    if (!empty(basket.custom.talononeCouponCodes)) {
        var appliedCoupons = basket.custom.talononeCouponCodes;

        appliedCoupons.forEach(function (key) {
            couponCodes.push(key);
        });
    }

    return couponCodes;
}

/**
 * Retrieve the rejected free item product id.
 * @param {dw.order.Basket} basket - Current user's basket
 * @return {Array} the rejected free item id
 */
function getRejectedFreeItems(basket) {
    var rejectedFreeItemId = [];
    if (!empty(basket.custom.talononeRejectedFreeItem)) {
        var FreeItemId = basket.custom.talononeRejectedFreeItem;

        FreeItemId.forEach(function (key) {
            rejectedFreeItemId.push(key);
        });
    }

    return rejectedFreeItemId;
}

/**
 * Retrieve the referral code which are available on basket.
 * @param {dw.order.Basket} basket - Current user's basket
 * @return {string} the referral codes present on basket
 */
function checkReferralCode(basket) {
    var referral = '';
    if (basket.custom.referralCode) {
        referral = basket.custom.referralCode;
    }
    return referral;
}

/**
 * Builds the entire object required for the create customer session request
 * @param  {Object} basket - Basket object
 * @param  {string} state - state is the status of current customer_sessions
 * @param  {string} couponCode - coupon code
 * @param  {string} referralCode - referral code
 * @return {Object} a valid object for the create customer session request
 */
function buildCreateCustomerSessionRequest(basket, state, couponCode, referralCode) {
    var sessionID = getSessionID(basket);
    var requestObject = {
        body: {
            customerSession: {
                profileId: getProfileID(),
                state: state,
                cartItems: getCartItems(basket),
                couponCodes: getCouponCodes(basket, couponCode),
                referralCode: checkReferralCode(basket, referralCode),
                attributes: {
                    Currency: basket.currencyCode,
                    SiteId: Site.current.ID,
                    ShippingMethod: !empty(basket.shipments[0].shippingMethodID) ? basket.shipments[0].shippingMethodID : '',
                    ShippingCity: !empty(basket.shipments[0].shippingAddress) ? basket.shipments[0].shippingAddress.city : '',
                    PaymentMethod: !empty(basket.getPaymentInstruments()) ? basket.paymentInstruments[0].paymentMethod : '',
                    rejected_free_items: getRejectedFreeItems(basket)
                },
                additionalCosts: {
                    ShippingCost: {
                        price: basket.shipments[0].getShippingTotalPrice().value
                    }
                }
            },
            responseContent: [
                'customerSession',
                'customerProfile',
                'triggeredCampaigns',
                'coupons'
            ]
        },
        method: 'PUT',
        url: 'customer_sessions/' + sessionID,
        auth: talonOnePreferences.getAPIKeyPrefix() + ' ' + talonOnePreferences.getAPIKey(),
        sessionId: sessionID

    };

    return requestObject;
}

/**
 * Builds the entire object required for the create customer profile request
 * @param  {Object} profile - Profile object
 * @return {Object} a valid object for the create customer profile request
 */
function createCustomerProfilesRequest(profile) {
    var runRuleEngine = false;
    var profileID = getProfileID();
    var requestObject = {
        body: {
            attributes: profile
        },
        method: 'PUT',
        url: 'customer_profiles/' + profileID + '?runRuleEngine=' + runRuleEngine,
        auth: talonOnePreferences.getAPIKeyPrefix() + ' ' + talonOnePreferences.getAPIKey()
    };

    return requestObject;
}

/**
 * Builds the entire object required for the create createAttributesRequest request
 * @return {Object} a valid object for the create createAttributesRequest request
 */
function createAttributesRequest() {
    var attributesObject = JSON.parse(talonOnePreferences.fetchAttributesObject());
    var requestObject = {};
    requestObject = {
        body: attributesObject,
        method: 'PUT',
        auth: talonOnePreferences.getAPIKeyPrefix() + ' ' + talonOnePreferences.getAPIKey(),
        url: 'integration/multiple_attributes'
    };
    return requestObject;
}

module.exports = {
    buildCreateCustomerSessionRequest: buildCreateCustomerSessionRequest,
    getProfileID: getProfileID,
    getCouponCodes: getCouponCodes,
    getRejectedFreeItems: getRejectedFreeItems,
    createCustomerProfilesRequest: createCustomerProfilesRequest,
    createAttributesRequest: createAttributesRequest
};
