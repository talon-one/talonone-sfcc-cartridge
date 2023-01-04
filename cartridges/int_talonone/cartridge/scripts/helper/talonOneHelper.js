/* globals empty, session, dw */

'use strict';

var TalonOneServiceWrapper = require('*/cartridge/scripts/util/talonOneServiceWrapper');
var TalonOnePreferences = require('*/cartridge/scripts/util/talonOnePreferences');
var talonOneUtils = require('*/cartridge/scripts/util/talonOneUtils');
var Transaction = require('dw/system/Transaction');
var HashMap = require('dw/util/HashMap');
var Logger = require('dw/system/Logger').getLogger('talonone', 'talonone');
var Locale = require('dw/util/Locale');
var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');

/**
 * On placing an order, a closed session of customer sessions are called onto Talonone.
 * @param {dw.order.Order} order Order
 */
function updateCloseOrderSession(order) {
    if (!empty(order) && TalonOnePreferences.isEnabled()) {
        var customerSessionData = TalonOneServiceWrapper.customer_sessions(order, 'closed');
        if (!customerSessionData.error) {
            Transaction.wrap(function () {
                order.custom.customerSessionID = session.privacy.customerSessionID; // eslint-disable-line
                order.custom.customerProfileID = session.privacy.customerProfileID; // eslint-disable-line
            });

            delete session.privacy.customerSessionID;
            delete session.privacy.customerProfileID;
            Logger.info('Customer Session id ' + order.custom.customerSessionID + 'is closed on its order confirmation for order no' + order.orderNo);
        } else {
            Logger.error('Error on closing a Customer Session id' + session.privacy.customerSessionID + 'on its order confirmation' + session.privacy.customerSessionID);
        }
    }
}

/**
 * Create the couponline item based on Talonone service response while adding coupon code
 * @param {Object} basket - Basket object
 * @param {string} couponCode - coupon code
 * @param {string} state - state is the status of current customer_sessions
 * @returns {dw.order.CouponLineItem} couponLineItem Coupon line item
 */
function addTalononeCoupon(basket, couponCode, state) {
    var couponLineItem;
    var currentBasket = basket;
    var customerSessionResponse = TalonOneServiceWrapper.customer_sessions(currentBasket, state, couponCode);

    if (!customerSessionResponse.error) {
        var response = JSON.parse(customerSessionResponse.result.text);
        var responseEffects = response.effects;

        responseEffects.forEach(function (effect) {
            if (effect.effectType === 'acceptCoupon' && effect.props.value === couponCode) {
                var couponCodes = talonOneUtils.getCouponCodes(currentBasket);
                couponCodes.push(couponCode);

                Transaction.wrap(function () {
                    couponLineItem = currentBasket.createCouponLineItem(couponCode, false);
                    currentBasket.custom.talononeCouponCodes = couponCodes;
                });
            }
        });
    } else {
        Logger.error('Error on talonone service call, while coupon codes are added');
    }

    return couponLineItem;
}

/**
 * Retrieve the discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @param {Object} discountEffect - The discounted effect details
 * @returns {Object} details - contains all effect details
 */
function getDiscountDetails(responseEffect, discountEffect) {
    var details = {};
    details.campaignId = discountEffect.campaignId;
    details.ruleName = discountEffect.ruleName;
    details.rulesetId = discountEffect.rulesetId;
    details.effectType = discountEffect.effectType;

    if (discountEffect.triggeredByCoupon) {
        responseEffect.forEach(function (orderEffect) {
            if (orderEffect.effectType === 'acceptCoupon' && orderEffect.campaignId === discountEffect.campaignId && orderEffect.triggeredByCoupon === discountEffect.triggeredByCoupon) {
                details.triggeredByCoupon = orderEffect.triggeredByCoupon;
                details.couponCode = orderEffect.props.value;
            }
        });
    }

    return details;
}

/**
 * Retrieve the order discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} orderDiscountDetails - contains all order level discount effect details
 */
function getOrderDiscountDetails(responseEffect) {
    var orderDiscountDetails = {};

    responseEffect.forEach(function (orderDiscountEffect) {
        if (orderDiscountEffect.effectType === 'setDiscount') {
            var orderAdjustmentUuId = orderDiscountEffect.rulesetId + '_' + orderDiscountEffect.campaignId;

            if (orderDiscountEffect.triggeredByCoupon) {
                orderAdjustmentUuId = orderAdjustmentUuId + '_' + orderDiscountEffect.triggeredByCoupon;
            }

            if (!empty(orderDiscountDetails) && orderDiscountDetails[orderAdjustmentUuId]) {
                orderDiscountDetails[orderAdjustmentUuId].discount += orderDiscountEffect.props.value;
            } else {
                orderDiscountDetails[orderAdjustmentUuId] = [];
                orderDiscountDetails[orderAdjustmentUuId] = getDiscountDetails(responseEffect, orderDiscountEffect);
                orderDiscountDetails[orderAdjustmentUuId].discount = orderDiscountEffect.props.value;
            }
        }
    });

    return orderDiscountDetails;
}

/**
 * Retrieve the product discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} productDiscountDetails - contains all product level discount effect details
 */
function getProductDiscountDetails(responseEffect) {
    var productDiscountDetails = {};

    responseEffect.forEach(function (productDiscountEffect) {
        if (productDiscountEffect.effectType === 'setDiscountPerItem') {
            var itemPosition = productDiscountEffect.props.position;
            var adjustmentUuId = itemPosition + '_' + productDiscountEffect.campaignId;

            if (productDiscountEffect.triggeredByCoupon) {
                adjustmentUuId = adjustmentUuId + '_' + productDiscountEffect.triggeredByCoupon;
            }

            if (productDiscountDetails[itemPosition]) {
                var adjustment = productDiscountDetails[itemPosition].priceAdjustment;

                if (adjustment[adjustmentUuId]) {
                    adjustment[adjustmentUuId].discount += productDiscountEffect.props.value;
                } else {
                    adjustment[adjustmentUuId] = getDiscountDetails(responseEffect, productDiscountEffect);
                    adjustment[adjustmentUuId].discount = productDiscountEffect.props.value;
                }
            } else {
                productDiscountDetails[itemPosition] = {};
                productDiscountDetails[itemPosition].priceAdjustment = [];
                productDiscountDetails[itemPosition].priceAdjustment[adjustmentUuId] = getDiscountDetails(responseEffect, productDiscountEffect);
                productDiscountDetails[itemPosition].priceAdjustment[adjustmentUuId].discount = productDiscountEffect.props.value;
            }
        }
    });

    return productDiscountDetails;
}

/**
 * Retrieve the shipping discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} shippingDiscountDetails - contains all shipping level discount effect details
 */
function getShippingDiscountDetails(responseEffect) {
    var shippingDiscountDetails = {};

    responseEffect.forEach(function (shippingDiscountEffect) {
        if (shippingDiscountEffect.effectType === 'setDiscountPerAdditionalCost') {
            var shippingAdjustmentUuId = shippingDiscountEffect.rulesetId + '_' + shippingDiscountEffect.campaignId;

            if (shippingDiscountEffect.triggeredByCoupon) {
                shippingAdjustmentUuId = shippingAdjustmentUuId + '_' + shippingDiscountEffect.triggeredByCoupon;
            }

            if (!empty(shippingDiscountDetails) && shippingDiscountDetails[shippingAdjustmentUuId]) {
                shippingDiscountDetails[shippingAdjustmentUuId].discount += shippingDiscountEffect.props.value;
            } else {
                shippingDiscountDetails[shippingAdjustmentUuId] = [];
                shippingDiscountDetails[shippingAdjustmentUuId] = getDiscountDetails(responseEffect, shippingDiscountEffect);
                shippingDiscountDetails[shippingAdjustmentUuId].discount = shippingDiscountEffect.props.value;
            }
        }
    });

    return shippingDiscountDetails;
}

/**
 * Retrieve the free item discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} freeItemDetails - contains all free item discount effect details
 */
function getFreeItemDetails(responseEffect) {
    var freeItemDetails = {};

    responseEffect.forEach(function (freeItemDiscountEffect) {
        if (freeItemDiscountEffect.effectType === 'addFreeItem') {
            var discountItemSku = freeItemDiscountEffect.props.sku;

            if (freeItemDetails[discountItemSku]) {
                freeItemDetails[discountItemSku].qty += 1;
            } else {
                freeItemDetails[discountItemSku] = [];
                freeItemDetails[discountItemSku] = getDiscountDetails(responseEffect, freeItemDiscountEffect);
                freeItemDetails[discountItemSku].qty = 1;
            }
        }
    });

    return freeItemDetails;
}

/**
 * Retrieve the loyalty discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} shippingDiscountDetails - contains all shipping level discount effect details
 */
function getLoyaltyPointDetails(responseEffect) {
    var addLoyaltyPoints = 0;
    var deductLoyaltyPoints = 0;
    responseEffect.forEach(function (loyaltyDetails) {
        if (loyaltyDetails.effectType === 'addLoyaltyPoints') {
            addLoyaltyPoints += loyaltyDetails.props.value;
        } else if (loyaltyDetails.effectType === 'deductLoyaltyPoints') {
            deductLoyaltyPoints += loyaltyDetails.props.value;
        }
    });

    var loyaltyBalance = (addLoyaltyPoints - deductLoyaltyPoints);
    if (loyaltyBalance) {
        session.privacy.loyaltyBalance = loyaltyBalance;
    }

    return true;
}

/**
 * Retrieve the rejected coupon discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} rejectedCouponDetails - contains all rejected coupon discount effect details
 */
function getRejectedCoupons(responseEffect) {
    var rejectedCouponDetails = {};

    responseEffect.forEach(function (rejectedCouponEffect) {
        if (rejectedCouponEffect.effectType === 'rejectCoupon') {
            var rejctedCouponCode = rejectedCouponEffect.props.value;
            rejectedCouponDetails[rejctedCouponCode] = [];
            rejectedCouponDetails[rejctedCouponCode].campaignId = rejectedCouponEffect.campaignId;
            rejectedCouponDetails[rejctedCouponCode].ruleName = rejectedCouponEffect.ruleName;
            rejectedCouponDetails[rejctedCouponCode].rulesetId = rejectedCouponEffect.rulesetId;
            rejectedCouponDetails[rejctedCouponCode].effectType = rejectedCouponEffect.effectType;
            rejectedCouponDetails[rejctedCouponCode].couponCode = rejectedCouponEffect.props.value;
            rejectedCouponDetails[rejctedCouponCode].rejectionReason = rejectedCouponEffect.props.rejectionReason;
        }
    });

    return rejectedCouponDetails;
}

/**
 * Retrieve the rejected referral discount details from the Talonone responses
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} rejectedReferralDetails - contains all rejected referral discount effect details
 */
function getRejectedReferral(responseEffect) {
    var rejectedReferralDetails = {};

    responseEffect.forEach(function (rejectedReferralEffect) {
        if (rejectedReferralEffect.effectType === 'rejectReferral') {
            rejectedReferralDetails.campaignId = rejectedReferralEffect.campaignId;
            rejectedReferralDetails.ruleName = rejectedReferralEffect.ruleName;
            rejectedReferralDetails.rulesetId = rejectedReferralEffect.rulesetId;
            rejectedReferralDetails.effectType = rejectedReferralEffect.effectType;
            rejectedReferralDetails.referralCode = rejectedReferralEffect.props.value;
            rejectedReferralDetails.rejectionReason = rejectedReferralEffect.props.rejectionReason;
        }
    });

    return rejectedReferralDetails;
}

/**
 * Retrieve the line item position Map with respect to Talonone responses.
 * @param {Object} cartItemDetails - Contains all cart item details from Talonone response
 * @returns {dw.util.HashMap} lineItemPositionMap - Contains the sfcc line item position mapped to Talonone cartitem position
 */
function getLineItemPosition(cartItemDetails) {
    var lineItemPositionMap = new HashMap();

    Object.keys(cartItemDetails).forEach(function (index) {
        var itemDetails = cartItemDetails[index];
        var position = itemDetails.attributes.itemPosition;
        lineItemPositionMap.put(position, itemDetails.position);
    });

    return lineItemPositionMap;
}

/**
 * Structure all the Talonone response effect to effect type
 * @param {Object} responseEffect - All responses from Talonone effects
 * @returns {Object} discountDetails - contains the structured all level discount effect details
 */
function getResponseEffects(responseEffect) {
    if (session.privacy.loyaltyBalance) {
        delete session.privacy.loyaltyBalance;
    }
    var discountDetails = {
        orderDiscountDetails: {},
        productDiscountDetails: {},
        shippingDiscountDetails: {},
        freeItemDiscountDetails: {},
        rejectedCouponDetails: {},
        rejectedReferralDetails: {}
    };

    if (!empty(responseEffect)) {
        discountDetails.orderDiscountDetails = getOrderDiscountDetails(responseEffect);
        discountDetails.productDiscountDetails = getProductDiscountDetails(responseEffect);
        discountDetails.shippingDiscountDetails = getShippingDiscountDetails(responseEffect);
        discountDetails.freeItemDiscountDetails = getFreeItemDetails(responseEffect);
        discountDetails.rejectedCouponDetails = getRejectedCoupons(responseEffect);
        discountDetails.rejectedReferralDetails = getRejectedReferral(responseEffect);
        getLoyaltyPointDetails(responseEffect);
    }

    return discountDetails;
}

/**
 * Applying the order discount with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} orderDiscountDetails - Contains the structured order discount details
 */
function applyOrderDiscount(basket, orderDiscountDetails) {
    var basketPriceAdjustments = basket.getPriceAdjustments().iterator();
    var orderPriceAdjustment;
    var orderAdjustmentUuId;
    var discountAmount;
    var discountDetails;
    var couponLineItem;
    var appliedBasketAdjustmentsIdMap = new HashMap();

    if (basketPriceAdjustments.hasNext()) {
        while (basketPriceAdjustments.hasNext()) {
            orderPriceAdjustment = basketPriceAdjustments.next();
            orderAdjustmentUuId = orderPriceAdjustment.custom.talonOnePriceAdjustment;
            if (orderAdjustmentUuId) {
                discountDetails = orderDiscountDetails[orderAdjustmentUuId];
                if (discountDetails && discountDetails.effectType === 'setDiscount') {
                    discountAmount = orderDiscountDetails[orderAdjustmentUuId].discount;

                    if (orderPriceAdjustment.getPriceValue() !== discountAmount) {
                        orderPriceAdjustment.setPriceValue(-discountAmount);

                        if (discountDetails.triggeredByCoupon && discountDetails.couponCode) {
                            couponLineItem = basket.getCouponLineItem(discountDetails.couponCode);

                            if (couponLineItem) {
                                couponLineItem.associatePriceAdjustment(orderPriceAdjustment);
                            }
                        }

                        appliedBasketAdjustmentsIdMap.put(orderAdjustmentUuId, orderAdjustmentUuId);
                    }
                } else {
                    basket.removePriceAdjustment(orderPriceAdjustment);
                }
            }
        }
    }

    Object.keys(orderDiscountDetails).forEach(function (key) {
        if (key !== appliedBasketAdjustmentsIdMap.get(key)) {
            discountDetails = orderDiscountDetails[key];
            discountAmount = discountDetails.discount;

            orderPriceAdjustment = basket.createPriceAdjustment(key, new dw.campaign.AmountDiscount(discountAmount)); // move all price adjustment uuid to key new UUID
            orderPriceAdjustment.setPriceValue(-discountAmount);
            orderPriceAdjustment.custom.isTalonOneAdjustment = true;
            orderPriceAdjustment.custom.talonOnePriceAdjustment = key;
            orderPriceAdjustment.custom.talonOnePromotionRuleName = discountDetails.ruleName;
            orderPriceAdjustment.setLineItemText(discountDetails.ruleName);

            if (discountDetails.triggeredByCoupon && discountDetails.couponCode) {
                couponLineItem = basket.getCouponLineItem(discountDetails.couponCode);

                if (couponLineItem) {
                    couponLineItem.associatePriceAdjustment(orderPriceAdjustment);
                }
            }
        }
    });
}

/**
 * Checks if the lineitem price adjustments already exist and if not,a new lineitemPriceAdjustments are created
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {dw.order.ProductLineItem} productLineItem - Current basket product LineItem
 * @param {Object} priceAdjustment - Contains the  price adjustment details
 * @param {dw.util.HashMap} appliedLineItemAdjustmentsIdMap - Contains the applied line item adjustments
 */
function createLineItemPriceAdjustment(basket, productLineItem, priceAdjustment, appliedLineItemAdjustmentsIdMap) {
    var priceAdjustmentDetails;
    var discountAmount;
    var couponLineItem;

    Object.keys(priceAdjustment).forEach(function (adjustmentUuid) {
        var appliedUuid = appliedLineItemAdjustmentsIdMap.get(adjustmentUuid);

        if (empty(appliedUuid)) {
            priceAdjustmentDetails = priceAdjustment[adjustmentUuid];
            discountAmount = priceAdjustmentDetails.discount;

            var lineItemPriceAdjustment = productLineItem.createPriceAdjustment(adjustmentUuid, new dw.campaign.AmountDiscount(discountAmount));

            lineItemPriceAdjustment.setPriceValue(-discountAmount);
            lineItemPriceAdjustment.custom.isTalonOneAdjustment = true;
            lineItemPriceAdjustment.custom.talonOnePriceAdjustment = adjustmentUuid;
            lineItemPriceAdjustment.custom.talonOnePromotionRuleName = priceAdjustmentDetails.ruleName;
            lineItemPriceAdjustment.setLineItemText(priceAdjustmentDetails.ruleName);

            if (priceAdjustmentDetails.triggeredByCoupon && priceAdjustmentDetails.couponCode) {
                couponLineItem = basket.getCouponLineItem(priceAdjustmentDetails.couponCode);

                if (couponLineItem) {
                    couponLineItem.associatePriceAdjustment(lineItemPriceAdjustment);
                }
            }
        }
    });
}

/**
 * Applying the product discount with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} productDiscountDetails - Contains the structured product discount details
 * @param {dw.util.HashMap} lineItemPosition - Contains the sfcc line item position mapped to Talonone cartitem position
 */
function applyProductDiscount(basket, productDiscountDetails, lineItemPosition) {
    var lineItemPriceAdjustment;
    var productLineItems = basket.getProductLineItems().iterator();
    var lineItemAdjustmentUuId;
    var appliedLineItemAdjustmentsIdMap;
    var priceAdjustmentDetails;
    var discountAmount;
    var couponLineItem;

    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();

        var itemPosition = lineItemPosition.get(productLineItem.position);

        appliedLineItemAdjustmentsIdMap = new HashMap();

        var discountPriceAdjustments = productDiscountDetails[itemPosition];

        var priceAdjustment = [];
        if (typeof (discountPriceAdjustments) !== 'undefined') {
            priceAdjustment = discountPriceAdjustments.priceAdjustment;
        }

        var lineItemPriceAdjustments = productLineItem.getPriceAdjustments().iterator();
        if (lineItemPriceAdjustments.hasNext()) {
            while (lineItemPriceAdjustments.hasNext()) {
                lineItemPriceAdjustment = lineItemPriceAdjustments.next();
                lineItemAdjustmentUuId = lineItemPriceAdjustment.custom.talonOnePriceAdjustment;

                if (lineItemAdjustmentUuId) {
                    if (priceAdjustment && priceAdjustment[lineItemAdjustmentUuId]) {
                        priceAdjustmentDetails = priceAdjustment[lineItemAdjustmentUuId];
                        discountAmount = priceAdjustmentDetails.discount;
                        if (priceAdjustmentDetails.effectType === 'setDiscountPerItem' && lineItemPriceAdjustment.getPriceValue() !== discountAmount) {
                            lineItemPriceAdjustment.setPriceValue(-discountAmount);

                            if (priceAdjustmentDetails.triggeredByCoupon && priceAdjustmentDetails.couponCode) {
                                couponLineItem = basket.getCouponLineItem(priceAdjustmentDetails.couponCode);

                                if (couponLineItem) {
                                    couponLineItem.associatePriceAdjustment(lineItemPriceAdjustment);
                                }
                            }

                            appliedLineItemAdjustmentsIdMap.put(lineItemAdjustmentUuId, lineItemAdjustmentUuId);
                        }
                    } else {
                        productLineItem.removePriceAdjustment(lineItemPriceAdjustment);
                    }
                }
            }
        }

        if (priceAdjustment !== undefined) {
            createLineItemPriceAdjustment(basket, productLineItem, priceAdjustment, appliedLineItemAdjustmentsIdMap);
        }
    }
}

/**
 * Checks if the shipping price adjustments already exist and if not,a new shippingPriceAdjustments are created
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {dw.order.ShippingLineItem} shippingLineItem - Current basket Shipping LineItem
 * @param {Object} shippingDiscountDetails - Contains the structured shipping discount details
 * @param {dw.util.HashMap} appliedShippingAdjustmentsIdMap - Contains the applied shipping adjustments
 */
function createShippingPriceAdjustment(basket, shippingLineItem, shippingDiscountDetails, appliedShippingAdjustmentsIdMap) {
    var discountDetails;
    var shippingPriceAdjustment;
    var discountAmount;
    var couponLineItem;
    Object.keys(shippingDiscountDetails).forEach(function (key) {
        if (key !== appliedShippingAdjustmentsIdMap.get(key)) {
            discountDetails = shippingDiscountDetails[key];
            discountAmount = discountDetails.discount;

            shippingPriceAdjustment = shippingLineItem.createShippingPriceAdjustment(key, new dw.campaign.AmountDiscount(discountAmount));
            shippingPriceAdjustment.setPriceValue(-discountAmount);
            shippingPriceAdjustment.custom.isTalonOneAdjustment = true;
            shippingPriceAdjustment.custom.talonOnePriceAdjustment = key;
            shippingPriceAdjustment.custom.talonOnePromotionRuleName = discountDetails.ruleName;
            shippingPriceAdjustment.setLineItemText(discountDetails.ruleName);

            if (discountDetails.triggeredByCoupon && discountDetails.couponCode) {
                couponLineItem = basket.getCouponLineItem(discountDetails.couponCode);

                if (couponLineItem) {
                    couponLineItem.associatePriceAdjustment(shippingPriceAdjustment);
                }
            }
        }
    });
}

/**
 * Applying the shipping discount with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} shippingDiscountDetails - Contains the structured shipping discount details
 */
function applyShippingDiscount(basket, shippingDiscountDetails) {
    var shipments = basket.getShipments().iterator();
    var shippingPriceAdjustment;
    var shippingAdjustmentUuId;
    var discountDetails;
    var couponLineItem;
    var appliedShippingAdjustmentsIdMap = new HashMap();
    var discountAmount;

    while (shipments.hasNext()) {
        var shipment = shipments.next();
        var shippingLineItems = shipment.getShippingLineItems().iterator();

        while (shippingLineItems.hasNext()) {
            var shippingLineItem = shippingLineItems.next();
            var shippingPriceAdjustments = shippingLineItem.getShippingPriceAdjustments().iterator();

            if (shippingPriceAdjustments.hasNext()) {
                while (shippingPriceAdjustments.hasNext()) {
                    shippingPriceAdjustment = shippingPriceAdjustments.next();
                    shippingAdjustmentUuId = shippingPriceAdjustment.custom.talonOnePriceAdjustment;

                    if (shippingAdjustmentUuId) {
                        discountDetails = shippingDiscountDetails[shippingAdjustmentUuId];
                        if (discountDetails && discountDetails.effectType === 'setDiscountPerAdditionalCost') {
                            discountAmount = shippingDiscountDetails[shippingAdjustmentUuId].discount;

                            if (shippingPriceAdjustment.getPriceValue() !== discountAmount) {
                                shippingPriceAdjustment.setPriceValue(-discountAmount);

                                if (discountDetails.triggeredByCoupon && discountDetails.couponCode) {
                                    couponLineItem = basket.getCouponLineItem(discountDetails.couponCode);

                                    if (couponLineItem) {
                                        couponLineItem.associatePriceAdjustment(shippingPriceAdjustment);
                                    }
                                }

                                appliedShippingAdjustmentsIdMap.put(shippingAdjustmentUuId, shippingAdjustmentUuId);
                            }
                        } else {
                            shippingLineItem.removeShippingPriceAdjustment(shippingPriceAdjustment);
                        }
                    }
                }
            }

            createShippingPriceAdjustment(basket, shippingLineItem, shippingDiscountDetails, appliedShippingAdjustmentsIdMap);
        }
    }
}

/**
 * Checks if the free item & its discounted price adjustments already exist in the cart and if not,a new product lineitem for discounted product are added to cart.
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} freeItemDiscountDetails - Contains the structured free item discount details
 * @param {dw.util.HashMap} appliedFreeItemSkuMap - Contains the applied free item sku map
 */
function createFreeItemPriceAdjustment(basket, freeItemDiscountDetails, appliedFreeItemSkuMap) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var cartHelper = require('*/cartridge/scripts/cart/cartHelpers');

    Object.keys(freeItemDiscountDetails).forEach(function (discountItemSku) {
        var appliedSku = appliedFreeItemSkuMap.get(discountItemSku);

        if (appliedSku !== discountItemSku) {
            var discountDetails = freeItemDiscountDetails[discountItemSku];
            var discountItemQty = discountDetails.qty;
            var product = ProductMgr.getProduct(discountItemSku);

            if (!empty(product) && product.variant) {
                if (product.getAvailabilityModel().isOrderable()) {
                    var productPrice = product.getPriceModel().getPrice().value;

                    var discountAmount = productPrice * discountItemQty;

                    var result = cartHelper.addProductToCart(
                        basket,
                        discountItemSku,
                        discountItemQty,
                        [],
                        []
                    );
                    var priceAdjustmentLineItem;

                    if (!result.error) {
                        var lineItems = basket.getProductLineItems().iterator();
                        while (lineItems.hasNext()) {
                            var lineItem = lineItems.next();
                            if (lineItem.productID === discountItemSku) {
                                if (empty(lineItem.priceAdjustments)) {
                                    priceAdjustmentLineItem = lineItem.createPriceAdjustment(discountDetails.campaignId, new dw.campaign.AmountDiscount(discountAmount));
                                } else {
                                    priceAdjustmentLineItem = lineItem.getPriceAdjustmentByPromotionID(discountDetails.campaignId);
                                    if (priceAdjustmentLineItem.getPriceValue() !== discountAmount) {
                                        priceAdjustmentLineItem.setPriceValue(-discountAmount);
                                    }
                                }

                                if (discountDetails.triggeredByCoupon && discountDetails.couponCode) {
                                    var couponLineItem = basket.getCouponLineItem(discountDetails.couponCode);

                                    if (couponLineItem) {
                                        couponLineItem.associatePriceAdjustment(priceAdjustmentLineItem);
                                    }
                                }

                                priceAdjustmentLineItem.custom.isTalonOneAdjustment = true;
                                priceAdjustmentLineItem.custom.isTalonOneFreeItem = true;
                                priceAdjustmentLineItem.custom.talonOneFreeItemQty = discountItemQty;
                                priceAdjustmentLineItem.custom.talonOneLineItemUuid = lineItem.getUUID();
                                priceAdjustmentLineItem.custom.talonOnePromotionRuleName = discountDetails.ruleName;
                                priceAdjustmentLineItem.setLineItemText(discountDetails.ruleName);
                                lineItem.custom.hasTalonOneFreeItem = true;

                                break;
                            }
                        }

                        if (!result.isNotCalculate) {
                            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
                            basketCalculationHelpers.calculateTotals(basket);
                        }
                    } else {
                        session.privacy.isTalonOneAddFreeItemError = true;
                    }
                } else {
                    session.privacy.isTalonOneAddFreeItemError = true;
                }
            }
        }
    });
}

/**
 * Applying the free item discount with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} freeItemDiscountDetails - Contains the structured free item discount details
 */
function applyFreeItemDiscount(basket, freeItemDiscountDetails) {
    var lineItemPriceAdjustment;
    var productLineItems = basket.getProductLineItems().iterator();
    var appliedFreeItemSkuMap = new HashMap();
    var freeItemDetails;
    var productPrice;
    var couponLineItem;

    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();

        freeItemDetails = freeItemDiscountDetails[productLineItem.productID];

        var lineItemPriceAdjustments = productLineItem.getPriceAdjustments().iterator();
        if (lineItemPriceAdjustments.hasNext()) {
            while (lineItemPriceAdjustments.hasNext()) {
                lineItemPriceAdjustment = lineItemPriceAdjustments.next();
                var isFreeItem = lineItemPriceAdjustment.custom.isTalonOneFreeItem;
                var freeItemQty = lineItemPriceAdjustment.custom.talonOneFreeItemQty;
                if (isFreeItem) {
                    var totalItemQty = productLineItem.getQuantity().value;
                    if (freeItemDetails) {
                        productPrice = productLineItem.product.getPriceModel().getPrice().value;
                        var discountedFreeItemQty = freeItemDetails.qty;
                        var discountedPrice = discountedFreeItemQty * productPrice;
                        if (lineItemPriceAdjustment.custom.talonOneFreeItemQty !== discountedFreeItemQty || lineItemPriceAdjustment.getPriceValue() !== discountedPrice) {
                            lineItemPriceAdjustment.setPriceValue(-discountedPrice);
                            if (totalItemQty === lineItemPriceAdjustment.custom.talonOneFreeItemQty) {
                                productLineItem.setQuantityValue(discountedFreeItemQty);
                            } else {
                                var customerAddedQty = totalItemQty - lineItemPriceAdjustment.custom.talonOneFreeItemQty;
                                if (customerAddedQty > 0) {
                                    var adjustedQty = customerAddedQty + discountedFreeItemQty;
                                    productLineItem.setQuantityValue(adjustedQty);
                                } else {
                                    productLineItem.setQuantityValue(discountedFreeItemQty);
                                }
                            }
                            lineItemPriceAdjustment.custom.talonOneFreeItemQty = discountedFreeItemQty;

                            if (freeItemDetails.triggeredByCoupon && freeItemDetails.couponCode) {
                                couponLineItem = basket.getCouponLineItem(freeItemDetails.couponCode);

                                if (couponLineItem) {
                                    couponLineItem.associatePriceAdjustment(lineItemPriceAdjustment);
                                }
                            }

                            appliedFreeItemSkuMap.put(productLineItem.productID, productLineItem.productID);
                        }
                    } else {
                        var updateQuantity = totalItemQty - freeItemQty;
                        if (totalItemQty === freeItemQty) {
                            basket.removeProductLineItem(productLineItem);
                        } else if (updateQuantity >= 1) {
                            productLineItem.setQuantityValue(updateQuantity);
                            productLineItem.removePriceAdjustment(lineItemPriceAdjustment);
                            productLineItem.custom.hasTalonOneFreeItem = false;
                        }
                    }
                }
            }
        }
    }

    createFreeItemPriceAdjustment(basket, freeItemDiscountDetails, appliedFreeItemSkuMap);
}

/**
 * Removing the rejected coupon code details with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} rejectedCouponDetails - Contains the structured rejected coupon code's discount details
 */
function removeRejectedCouponDiscount(basket, rejectedCouponDetails) {
    var currentBasket = basket;
    var appliedCoupons = currentBasket.custom.talononeCouponCodes;

    if (!empty(appliedCoupons)) {
        var couponCodes = [];

        Object.keys(appliedCoupons).forEach(function (key) {
            var appliedCode = appliedCoupons[key];
            var rejectedCouponDetail = rejectedCouponDetails[appliedCode];

            if (rejectedCouponDetail) {
                var couponLineItem = currentBasket.getCouponLineItem(rejectedCouponDetail.couponCode);
                currentBasket.removeCouponLineItem(couponLineItem);
            } else {
                couponCodes.push(appliedCode);
            }
        });

        currentBasket.custom.talononeCouponCodes = couponCodes;
    }
}

/**
 * Removing the rejected referral code details with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} rejectedReferralDetails - Contains the structured rejected referral code's discount details
 */
function removeRejectedReferralDiscount(basket, rejectedReferralDetails) {
    var currentBasket = basket;
    var appliedReferral = basket.custom.referralCode;

    if (appliedReferral === rejectedReferralDetails.referralCode) {
        currentBasket.custom.referralCode = '';
    }
}

/**
 * Executing each discountbwith respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {Object} discountEffects - Contains all the structured discount details
 * @param {dw.util.HashMap} lineItemPosition - Contains the sfcc line item position mapped to Talonone cartitem position
 */
function executeDiscountEffects(basket, discountEffects, lineItemPosition) {
    Transaction.wrap(function () {
        applyOrderDiscount(basket, discountEffects.orderDiscountDetails);

        applyProductDiscount(basket, discountEffects.productDiscountDetails, lineItemPosition);

        applyShippingDiscount(basket, discountEffects.shippingDiscountDetails);

        applyFreeItemDiscount(basket, discountEffects.freeItemDiscountDetails);

        removeRejectedCouponDiscount(basket, discountEffects.rejectedCouponDetails);

        removeRejectedReferralDiscount(basket, discountEffects.rejectedReferralDetails);

        var ShippingMgr = require('dw/order/ShippingMgr');
        ShippingMgr.applyShippingCost(basket);
    });
}

/**
 * Removing the productline item priceadjustment before removing the couponlineitem with respect to the response received from Talonone
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {dw.order.CouponLineItem} couponLineItem Coupon line item
 */
function removeFreeLineItemFromBasket(basket, couponLineItem) {
    var priceAjustments = couponLineItem.getPriceAdjustments().iterator();
    if (priceAjustments.hasNext()) {
        while (priceAjustments.hasNext()) {
            var priceAdjustment = priceAjustments.next();

            if (priceAdjustment.custom.isTalonOneFreeItem) {
                var productLineItems = basket.getProductLineItems();
                for (var i = 0; i < productLineItems.length; i++) {
                    var productLineItem = productLineItems[i];
                    if (productLineItem.getUUID() === priceAdjustment.custom.talonOneLineItemUuid) {
                        var freeItemQty = priceAdjustment.custom.talonOneFreeItemQty;
                        var totalItemQty = productLineItem.getQuantityValue();
                        var updateQty = totalItemQty - freeItemQty;
                        if (updateQty === 0) {
                            basket.removeProductLineItem(productLineItem);
                        } else {
                            productLineItem.setQuantityValue(updateQty);
                            productLineItem.removePriceAdjustment(priceAdjustment);
                            productLineItem.custom.hasTalonOneFreeItem = false;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Checks whether the object key is empty or not
 * @param {Object} obj - Object
 * @returns {Object} obj - Object
 */
function checkIsEmptyObj(obj) {
    var profileObj = obj;
    Object.keys(profileObj).forEach(function (key) {
        if (profileObj[key] === '' || profileObj[key] === null) {
            delete profileObj[key];
        }
    });

    return profileObj;
}

/**
 * Passing customer Locale ID.
 * @param {localeId} localeId - Current user's localeID
 */
function createCustomerProfile(localeId) {
    // eslint-disable-next-line no-undef
    var profile = customer.getProfile();
    var currentLocale = Locale.getLocale(localeId).ID;
    var profileID = talonOneUtils.getProfileID();

    var profileData = {
        BirthDate: profile.birthday,
        SignupDate: profile.creationDate,
        CustomerNo: profileID,
        Email: profile.email,
        Name: (profile.firstName + ' ' + profile.lastName),
        Phone: profile.phoneHome,
        Locale: currentLocale,
        SiteId: Site.current.ID
    };

    profileData = checkIsEmptyObj(profileData);

    if (TalonOnePreferences.isEnabled() && !empty(profileData)) {
        TalonOneServiceWrapper.customerProfiles(profileData);
    }
}

/**
 * Checks whether the productline item has any discount free item with respect to talonone response.
 * @param {dw.order.Basket} basket - Current user's basket
 * @returns {boolean} true if free item against are identified, false otherwise.
 */
function isTalonOneFreeItemExist(basket) {
    var productLineItems = basket.getProductLineItems().iterator();
    var isFreeItemExist = false;

    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();
        if (productLineItem.custom.hasTalonOneFreeItem) {
            isFreeItemExist = true;
            break;
        }
    }
    return isFreeItemExist;
}

/**
 * Checks whether the free line item product are removed by user with respect to talonone response.
 * @param {dw.order.Basket} basket - Current user's basket
 * @param {dw.order.ProductLineItem} productLineItem - Current basket product lineitem
 */
function talononeRejectedFreeItem(basket, productLineItem) {
    var currentBasket = basket;
    var rejectedFreeItem = talonOneUtils.getRejectedFreeItems(currentBasket);
    if (productLineItem.custom.hasTalonOneFreeItem) {
        rejectedFreeItem.push(productLineItem.productID);
    }

    Transaction.wrap(function () {
        currentBasket.custom.talononeRejectedFreeItem = rejectedFreeItem;
    });
}

/**
 * Calculate Loyalty Point
 * @param {boolean} isConfirmationPage - Check Is it confirmation page of SRFA
 * @param {string} page - To identify the page.
 * @param {string} referralCode - Referral Code
 * @returns {Object} response - Returns the Referral & Loyalty response object.
 */
function talonConfig(isConfirmationPage, page, referralCode) {
    var talonOnePreferences = require('*/cartridge/scripts/util/talonOnePreferences');
    var URLUtils = require('dw/web/URLUtils');
    var isTaloneOneEnabled = talonOnePreferences.isEnabled();
    var isLoyaltyEnabled = talonOnePreferences.isLoyaltyEnabled();
    var isReferralEnabled = talonOnePreferences.isReferralEnabled();
    var response = {};
    response.loyalty = {};
    response.referral = {};
    response.isConfirmationPage = isConfirmationPage;
    response.loyalty.isLoyaltyEnabled = false;
    response.referral.isReferralEnabled = false;
    if (isTaloneOneEnabled && isLoyaltyEnabled) {
        var netChange = (session.privacy.loyaltyBalance) ? session.privacy.loyaltyBalance : 0;
        if (netChange > 0) {
            response.loyalty.loyaltyTitle = Resource.msg('lablel.order.LoyaltyPointsToEarn', 'talonOne', null);
            if (isConfirmationPage && page !== 'Cart') {
                response.loyalty.loyaltyTitle = Resource.msg('lablel.order.LoyaltyPointsEarned', 'talonOne', null);
            }
        } else if (netChange < 0) {
            response.loyalty.loyaltyTitle = Resource.msg('lablel.order.LoyaltyPointsToSpend', 'talonOne', null);
            if (isConfirmationPage && page !== 'Cart') {
                response.loyalty.loyaltyTitle = Resource.msg('lablel.order.LoyaltyPointsRedeemed', 'talonOne', null);
            }
        }
        response.loyalty.loyaltyNetChange = parseFloat(Math.abs(netChange)).toFixed(2);
        if (response.loyalty.loyaltyNetChange > 0) {
            response.loyalty.isLoyaltyEnabled = true;
        }
    }

    if (isTaloneOneEnabled && isReferralEnabled) {
        response.referral.submitReferralCodeUrl = URLUtils.url('Cart-AddReferral').toString();
        response.referral.removeReferralCodeUrl = URLUtils.url('Cart-removeReferral').toString();
        response.referral.code = referralCode;
        response.referral.isReferralEnabled = true;
    }

    return response;
}

/**
 * Generate talon user friendly message
 * @param {string} msgCode - Message code
 * @returns {Object} msgCode Object.
 */
function rejectionReasonMessage(msgCode) {
    var message = '';
    switch (msgCode) {
        case 'CampaignLimitReached':
            message = Resource.msg('error.label.CampaignLimitReached', 'talonOne', null);
            break;
        case 'CouponExpired':
            message = Resource.msg('error.label.CouponExpired', 'talonOne', null);
            break;
        case 'CouponLimitReached':
            message = Resource.msg('error.label.CouponLimitReached', 'talonOne', null);
            break;
        case 'CouponNotFound':
            message = Resource.msg('error.label.CouponNotFound', 'talonOne', null);
            break;
        case 'CouponPartOfNotRunningCampaign':
            message = Resource.msg('error.label.CouponPartOfNotRunningCampaign', 'talonOne', null);
            break;
        case 'CouponPartOfNotTriggeredCampaign':
            message = Resource.msg('error.label.CouponPartOfNotTriggeredCampaign', 'talonOne', null);
            break;
        case 'CouponRecipientDoesNotMatch':
            message = Resource.msg('error.label.CouponRecipientDoesNotMatch', 'talonOne', null);
            break;
        case 'CouponRejectedByCondition':
            message = Resource.msg('error.label.CouponRejectedByCondition', 'talonOne', null);
            break;
        case 'CouponStartDateInFuture':
            message = Resource.msg('error.label.CouponStartDateInFuture', 'talonOne', null);
            break;
        case 'EffectCouldNotBeApplied':
            message = Resource.msg('error.label.EffectCouldNotBeApplied', 'talonOne', null);
            break;
        case 'ProfileLimitReached':
            message = Resource.msg('error.label.ProfileLimitReached', 'talonOne', null);
            break;
        case 'ProfileRequired':
            message = Resource.msg('error.label.ProfileRequired', 'talonOne', null);
            break;
        case 'ReferralCustomerAlreadyReferred':
            message = Resource.msg('error.label.ReferralCustomerAlreadyReferred', 'talonOne', null);
            break;
        case 'AdvocateNotFound':
            message = Resource.msg('error.label.AdvocateNotFound', 'talonOne', null);
            break;
        case 'ReferralExpired':
            message = Resource.msg('error.label.ReferralExpired', 'talonOne', null);
            break;
        case 'ReferralLimitReached':
            message = Resource.msg('error.label.ReferralLimitReached', 'talonOne', null);
            break;
        case 'ReferralNotFound':
            message = Resource.msg('error.label.ReferralNotFound', 'talonOne', null);
            break;
        case 'ReferralPartOfNotRunningCampaign':
            message = Resource.msg('error.label.ReferralPartOfNotRunningCampaign', 'talonOne', null);
            break;
        case 'ReferralRecipientDoesNotMatch':
            message = Resource.msg('error.label.ReferralRecipientDoesNotMatch', 'talonOne', null);
            break;
        case 'ReferralRecipientIdSameAsAdvocate':
            message = Resource.msg('error.label.ReferralRecipientIdSameAsAdvocate', 'talonOne', null);
            break;
        case 'ReferralRejectedByCondition':
            message = Resource.msg('error.label.ReferralRejectedByCondition', 'talonOne', null);
            break;
        case 'ReferralStartDateInFuture':
            message = Resource.msg('error.label.ReferralStartDateInFuture', 'talonOne', null);
            break;
        case 'ReferralValidConditionMissing':
            message = Resource.msg('error.label.ReferralValidConditionMissing', 'talonOne', null);
            break;
        default:
            message = Resource.msg('error.unable.to.add.referral', 'talonOne', null);
    }
    return message;
}

/**
 * Create the couponline item based on Talonone service response while adding referral code
 * @param {Object} basket - Basket object
 * @param {string} state - state is the status of current customer_sessions
 * @returns {Object} referralResponse - Referral Response
 */
function addTalononeReferral(basket, state) {
    var referralResponse = {};
    var customerSessionResponse = TalonOneServiceWrapper.customer_sessions(basket, state, '');
    var error = true;

    var message = Resource.msg('error.referral.invalid', 'talonOne', null);

    if (!customerSessionResponse.error) {
        var response = JSON.parse(customerSessionResponse.result.text);
        var responseEffects = response.effects;

        responseEffects.forEach(function (effect) {
            if (effect.effectType === 'rejectReferral') {
                message = rejectionReasonMessage(effect.props.rejectionReason);
            } else if (effect.effectType === 'acceptReferral') {
                error = false;
                message = Resource.msg('success.referral.applied', 'talonOne', null) + ' (' + effect.ruleName + ')';
            }
        });
    } else {
        Logger.error('Error on talonone service call, while referral codes are added');
    }

    referralResponse = { error: error, message: message };

    return referralResponse;
}

module.exports = {
    updateCloseOrderSession: updateCloseOrderSession,
    addTalononeCoupon: addTalononeCoupon,
    getLineItemPosition: getLineItemPosition,
    getResponseEffects: getResponseEffects,
    executeDiscountEffects: executeDiscountEffects,
    removeFreeLineItemFromBasket: removeFreeLineItemFromBasket,
    createCustomerProfile: createCustomerProfile,
    isTalonOneFreeItemExist: isTalonOneFreeItemExist,
    talononeRejectedFreeItem: talononeRejectedFreeItem,
    talonConfig: talonConfig,
    addTalononeReferral: addTalononeReferral
};

