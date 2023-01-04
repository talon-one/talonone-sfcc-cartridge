'use strict';

var app = require('*/cartridge/scripts/app');
var Transaction = require('dw/system/Transaction');
var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
var Cart = require('*/cartridge/scripts/models/CartModel');

/**
 * Adds a product to the cart. If the product is already in the cart it increases the quantity of
 * that product.
 * @param {dw.order.Basket} basket - Current users's basket
 * @param {string} productId - the productId of the product being added to the cart
 * @param {number} quantity - the number of products to the cart
 * @return {Object} returns an error object
 */
function addProductToCart(basket, productId, quantity) {
    try {
        var cart = app.getModel('Cart').goc();
        var Product = app.getModel('Product');
        var productToAdd = Product.get(productId);
        cart.addProductItem(productToAdd.object, quantity, productToAdd.object.getOptionModel(), true);
        return {
            error: false,
            isNotCalculate: true
        };
    } catch (e) {
        return {
            error: true
        };
    }
}

/**
 * Recalculate product to the cart. If a discount freeitem is already in the cart
 * with respect to the response received from Talonone
 *
 * @param {dw.order.Basket} cart - Current users's basket
 *
 */
function addFreeItemCartCalculate(cart) {
    if (talonOneHelper.isTalonOneFreeItemExist(cart)) {
        Transaction.wrap(function () {
            Cart.get(cart).calculate();
        });
    }
}

module.exports = {
    addProductToCart: addProductToCart,
    addFreeItemCartCalculate: addFreeItemCartCalculate
};
