/* globals empty, session, dw */

'use strict';

var page = module.superModule;

var server = require('server');
server.extend(page);

var talonOnePreferences = require('*/cartridge/scripts/util/talonOnePreferences');
var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.prepend('AddCoupon', server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        if (talonOnePreferences.isEnabled()) {
            var BasketMgr = require('dw/order/BasketMgr');
            var Resource = require('dw/web/Resource');
            var Transaction = require('dw/system/Transaction');
            var URLUtils = require('dw/web/URLUtils');
            var CartModel = require('*/cartridge/models/cart');
            var currentBasket = BasketMgr.getCurrentBasket();
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

            if (!currentBasket) {
                res.setStatusCode(500);
                res.json({
                    error: true,
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });

                return next();
            }

            if (!currentBasket) {
                res.setStatusCode(500);
                res.json({ errorMessage: Resource.msg('error.add.coupon', 'cart', null) });
                return next();
            }

            var error = false;
            var errorMessage;

            try {
                // Talonone - Begin: Creating couponline item based on the talonone response effects
                var addCouponToBasketResult = talonOneHelper.addTalononeCoupon(currentBasket, req.querystring.couponCode, 'open');

                if (!(addCouponToBasketResult instanceof dw.order.CouponLineItem)) {
                    error = true;
                    errorMessage = Resource.msg('error.unable.to.add.coupon', 'cart', null);
                }
                // Talonone - End: Creating couponline item based on the talonone response effects
            } catch (e) {
                error = true;
                var errorCodes = {
                    COUPON_CODE_ALREADY_IN_BASKET: 'error.coupon.already.in.cart',
                    COUPON_ALREADY_IN_BASKET: 'error.coupon.cannot.be.combined',
                    COUPON_CODE_ALREADY_REDEEMED: 'error.coupon.already.redeemed',
                    COUPON_CODE_UNKNOWN: 'error.unable.to.add.coupon',
                    COUPON_DISABLED: 'error.unable.to.add.coupon',
                    REDEMPTION_LIMIT_EXCEEDED: 'error.unable.to.add.coupon',
                    TIMEFRAME_REDEMPTION_LIMIT_EXCEEDED: 'error.unable.to.add.coupon',
                    NO_ACTIVE_PROMOTION: 'error.unable.to.add.coupon',
                    default: 'error.unable.to.add.coupon'
                };

                var errorMessageKey = errorCodes[e.errorCode] || errorCodes.default;
                errorMessage = Resource.msg(errorMessageKey, 'cart', null);
            }

            if (error) {
                res.json({
                    error: error,
                    errorMessage: errorMessage
                });
                return next();
            }

            Transaction.wrap(function () {
                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            // Talonone - Begin: while adding coupon to cart, this json data will determine whether any free talonone discount item exist in basket.
            if (talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
                res.json({
                    hasTalonOneFreeItem: true
                });
            }
            // Talonone - End: while adding coupon to cart, this json data will determine whether any free talonone discount item exist in basket.

            // Talonone - Begin: Checking Free item is in OOS or not.
            if (session.privacy.isTalonOneAddFreeItemError) {
                res.json({
                    isTalonOneAddFreeItemerror: true
                });

                delete session.privacy.isTalonOneAddFreeItemError;
            }
            // Talonone - End: Checking Free item is in OOS or not.

            // Talonone - Begin: Update Loyalty messages
            var referralCode = currentBasket.custom.referralCode;
            var talonOneLoyalty = talonOneHelper.talonConfig(false, '', referralCode);
            res.json({
                talonOneLoyalty: talonOneLoyalty
            });
            // Talonone - End: Update Loyalty messages

            var basketModel = new CartModel(currentBasket);
            res.json(basketModel);

            this.emit('route:Complete', req, res);

            return; // eslint-disable-line
        }

        return next();
    });

server.prepend('RemoveCouponLineItem',
    function (req, res, next) {
        if (talonOnePreferences.isEnabled()) {
            var BasketMgr = require('dw/order/BasketMgr');
            var Resource = require('dw/web/Resource');
            var Transaction = require('dw/system/Transaction');
            var URLUtils = require('dw/web/URLUtils');
            var CartModel = require('*/cartridge/models/cart');
            var collections = require('*/cartridge/scripts/util/collections');
            var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

            var currentBasket = BasketMgr.getCurrentBasket();

            if (!currentBasket) {
                res.setStatusCode(500);
                res.json({
                    error: true,
                    redirectUrl: URLUtils.url('Cart-Show').toString()
                });

                return next();
            }

            var couponLineItem;

            if (currentBasket && req.querystring.uuid) {
                couponLineItem = collections.find(currentBasket.couponLineItems, function (item) {
                    return item.UUID === req.querystring.uuid;
                });

                if (couponLineItem) {
                    Transaction.wrap(function () {
                        // Talonone - Begin: Removing/Updating free lineitem based on the talonone response effects
                        if (talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
                            res.json({
                                hasTalonOneFreeItem: true
                            });
                        }
                        // Talonone - End: Removing/Updating free lineitem based on the talonone response effects

                        // Talonone - Begin: Checking Free item is in OOS or not.
                        if (session.privacy.isTalonOneAddFreeItemError) {
                            res.json({
                                isTalonOneAddFreeItemerror: true
                            });

                            delete session.privacy.isTalonOneAddFreeItemError;
                        }
                        // Talonone - End: Checking Free item is in OOS or not.

                        talonOneHelper.removeFreeLineItemFromBasket(currentBasket, couponLineItem);

                        // Talonone - Begin: Removing the coupon code from basket custom attribute when the couponline items are removed.
                        var couponCodes = [];
                        if (!empty(currentBasket.custom.talononeCouponCodes)) {
                            var appliedCoupons = currentBasket.custom.talononeCouponCodes;
                            appliedCoupons.forEach(function (key) {
                                if (key !== couponLineItem.couponCode) {
                                    couponCodes.push(key);
                                }
                            });

                            currentBasket.custom.talononeCouponCodes = couponCodes;
                        }
                        // Talonone - End: Removing the coupon code from basket custom attribute when the couponline items are removed.

                        currentBasket.removeCouponLineItem(couponLineItem);
                        basketCalculationHelpers.calculateTotals(currentBasket);
                    });

                    // Talonone - Begin: Updating Loyalty messages.
                    var referralCode = currentBasket.custom.referralCode;
                    var talonOneLoyalty = talonOneHelper.talonConfig(false, '', referralCode);
                    res.json({
                        talonOneLoyalty: talonOneLoyalty
                    });
                    // Talonone - End: Updating Loyalty messages.

                    var basketModel = new CartModel(currentBasket);
                    res.json(basketModel);
                    this.emit('route:Complete', req, res);
                    return; // eslint-disable-line
                }
            }

            res.setStatusCode(500);
            res.json({ errorMessage: Resource.msg('error.cannot.remove.coupon', 'cart', null) });
            return next();
        }

        return next();
    });

server.prepend('RemoveProductLineItem',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        var URLUtils = require('dw/web/URLUtils');

        if (!currentBasket) {
            res.setStatusCode(500);
            res.json({
                error: true,
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        if (talonOnePreferences.isEnabled()) {
            // Talonone - Begin: On product lineitem removal, this json data will determine whether any free talonone discount item exist in basket.
            if (talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
                res.json({
                    hasTalonOneFreeItem: true
                });
            }
            // Talonone - End: On product lineitem removal, this json data will determine whether any free talonone discount item exist in basket.

            // Talonone - Begin: On Talonone free item product lineitem removal, we are updating the rejected free item id's to Talonone request.
            if (req.querystring.pid && req.querystring.uuid) {
                var productLineItems = currentBasket.getAllProductLineItems(req.querystring.pid);
                for (var i = 0; i < productLineItems.length; i++) {
                    var item = productLineItems[i];
                    if (item.UUID === req.querystring.uuid) {
                        talonOneHelper.talononeRejectedFreeItem(currentBasket, item);
                    }
                }
            }
            // Talonone - End: On Talonone free item product lineitem removal, we are updating the rejected free item id's to Talonone request.
        }

        return next();
    });

server.append('RemoveProductLineItem',
    function (req, res, next) {
        var viewData = res.getViewData();

        // Talonone - Begin: Checking Free item is in OOS or not.
        if (talonOnePreferences.isEnabled() && session.privacy.isTalonOneAddFreeItemError) {
            viewData.isTalonOneAddFreeItemerror = true;

            delete session.privacy.isTalonOneAddFreeItemError;
        }
        // Talonone - End: Checking Free item is in OOS or not.

        return next();
    });

server.prepend('UpdateQuantity',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        var URLUtils = require('dw/web/URLUtils');

        if (!currentBasket) {
            res.setStatusCode(500);
            res.json({
                error: true,
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        // Talonone - Begin: On decreasing qty, this json data will determine whether any free talonone discount item exist in basket.
        if (talonOnePreferences.isEnabled() && talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
            res.json({
                hasTalonOneFreeItem: true
            });
        }
        // Talonone - End: On decreasing qty, this json data will determine whether any free talonone discount item exist in basket.

        return next();
    });

server.append('UpdateQuantity',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();

        var viewData = res.getViewData();

        if (talonOnePreferences.isEnabled()) {
            // Talonone - Begin: On increasing qty, this json data will determine whether any free talonone discount item exist in basket.
            if (empty(viewData.hasTalonOneFreeItem)) {
                if (talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
                    res.json({
                        hasTalonOneFreeItem: true
                    });
                }
            }
            // Talonone - End: On increasing qty, this json data will determine whether any free talonone discount item exist in basket.

            // Talonone - Begin: Checking Free item is in OOS or not.
            if (session.privacy.isTalonOneAddFreeItemError) {
                res.json({
                    isTalonOneAddFreeItemerror: true
                });
            }
            delete session.privacy.isTalonOneAddFreeItemError;
            // Talonone - End: Checking Free item is in OOS or not.
        }

        return next();
    });

server.prepend('EditProductLineItem',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        var URLUtils = require('dw/web/URLUtils');

        if (!currentBasket) {
            res.setStatusCode(500);
            res.json({
                error: true,
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        // Talonone - Begin: On edit product, this json data will determine whether any free talonone discount item exist in basket.
        if (talonOnePreferences.isEnabled() && talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
            res.json({
                hasTalonOneFreeItem: true
            });
        }
        // Talonone - End: On edit product, this json data will determine whether any free talonone discount item exist in basket.

        return next();
    });

server.append('EditProductLineItem',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();

        var viewData = res.getViewData();

        // Talonone - Begin: On Edit product, this json data will determine whether any free talonone discount item exist in basket.
        if (empty(viewData.hasTalonOneFreeItem)) {
            if (talonOneHelper.isTalonOneFreeItemExist(currentBasket)) {
                viewData.hasTalonOneFreeItem = true;
            }
        }
        // Talonone - End: On product edit, this json data will determine whether any free talonone discount item exist in basket.

        // Talonone - Begin: Checking Free item is in OOS or not.
        if (talonOnePreferences.isEnabled()) {
            if (session.privacy.isTalonOneAddFreeItemError) {
                viewData.isTalonOneAddFreeItemerror = true;
            }
            delete session.privacy.isTalonOneAddFreeItemError;
        }
        // Talonone - End: Checking Free item is in OOS or not.

        res.setViewData(viewData);
        next();
    });

server.append('Show',
    function (req, res, next) {
        var viewData = res.getViewData();
        // Talonone - Start
        var BasketMgr = require('dw/order/BasketMgr');
        var getCurrentBasket = BasketMgr.getCurrentBasket();
        var referralCode;
        if (getCurrentBasket) {
            referralCode = getCurrentBasket.custom.referralCode;
        }
        viewData.talon = talonOneHelper.talonConfig(false, '', referralCode);
        // Talonone - End

        // Talonone - Begin: Checking Free item is in OOS or not.
        if (talonOnePreferences.isEnabled()) {
            if (session.privacy.isTalonOneAddFreeItemError) {
                viewData.isTalonOneAddFreeItemerror = true;
            }
            delete session.privacy.isTalonOneAddFreeItemError;
        }
        // Talonone - End: Checking Free item is in OOS or not.

        res.setViewData(viewData);
        next();
    });

server.get('AddReferral',
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Resource = require('dw/web/Resource');
        var Transaction = require('dw/system/Transaction');
        var CartModel = require('*/cartridge/models/cart');
        var currentBasket = BasketMgr.getCurrentBasket();
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var referralCode = req.querystring.referralCode;
        if (currentBasket.custom.referralCode) {
            res.json({
                error: true,
                message: Resource.msg('error.referral.used', 'talonOne', null)
            });
            return next();
        }

        if (referralCode) {
            Transaction.wrap(function () {
                currentBasket.custom.referralCode = referralCode;
            });
        }


        if (!currentBasket) {
            res.json({
                error: true,
                message: Resource.msg('error.cart.empty', 'talonOne', null)
            });

            return next();
        }

        var error = false;

        var message;

        try {
            // Talonone - Begin: Creating couponline item based on the talonone response effects
            if (talonOnePreferences.isEnabled() && talonOnePreferences.isReferralEnabled()) {
                var applyReferral = talonOneHelper.addTalononeReferral(currentBasket, 'open');
                error = applyReferral.error;
                message = applyReferral.message;
            } else {
                error = true;
                message = Resource.msg('error.referral.disabled', 'talonOne', null);
            }
            // Talonone - End: Creating couponline item based on the talonone response effects
        } catch (e) {
            error = true;
            message = Resource.msg('error.referral.wentWrong', 'talonOne', null);
            var Logger = require('dw/system/Logger');
            Logger.error('Error on Add Referral' + JSON.stringify(e));
        }

        if (error) {
            Transaction.wrap(function () {
                currentBasket.custom.referralCode = '';
            });

            res.json({
                error: error,
                message: message
            });

            return next();
        }

        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        var basketModel = new CartModel(currentBasket);

        res.json({
            error: error,
            message: message,
            result: basketModel
        });
        return next();
    });


server.get('removeReferral',

    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var CartModel = require('*/cartridge/models/cart');
        var currentBasket = BasketMgr.getCurrentBasket();
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

        Transaction.wrap(function () {
            currentBasket.custom.referralCode = '';
        });

        var error = false;
        var message;

        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        var basketModel = new CartModel(currentBasket);

        res.json({
            error: error,
            message: message,
            result: basketModel
        });
        return next();
    });

module.exports = server.exports();
