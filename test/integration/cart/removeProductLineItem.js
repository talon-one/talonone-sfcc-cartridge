var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Remove ProductLineItem', function () {
    this.timeout(50000);

    var cookieJar = request.jar();

    var myRequest = {
        url: '',
        method: 'POST',
        rejectUnauthorized: false,
        resolveWithFullResponse: true,
        jar: cookieJar,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    };

    var variantPid = '701643421084M'; // 3/4 Sleeve V-Neck Top: icy mint, XS
    var qty = 1;
    var addProduct = '/Cart-AddProduct';

    myRequest.url = config.baseUrl + addProduct;
    myRequest.form = {
        pid: variantPid,
        quantity: qty
    };

    var variantUuid;

    before(function () {
        return request(myRequest)
            .then(function (addToCartResponse) {
                var bodyAsJson = JSON.parse(addToCartResponse.body);
                variantUuid = bodyAsJson.cart.items[0].UUID;
                assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
            });
    });


    it('should remove the product line item from basket', function () {
        // remove product variant

        myRequest.method = 'GET';
        myRequest.url = config.baseUrl + '/Cart-RemoveProductLineItem?pid=' + variantPid +
            '&uuid=' + variantUuid;

        var expectedUpdateRep = {
            'action': 'Cart-RemoveProductLineItem',
            'basket': {
                'totals': {
                    'subTotal': '$0.00'
                },
                'items': [],
                'numItems': 0,
                'resources': {
                    'numberOfItems': '0 Items',
                    'emptyCartMsg': 'Your Shopping Cart is Empty'
                }
            },
            'locale': 'en_US'
        };

        return request(myRequest)
            .then(function (updateResponse) {
                assert.equal(updateResponse.statusCode, 200, 'Expected statusCode to be 200.');

                var bodyAsJson = JSON.parse(updateResponse.body);
                assert.containSubset(bodyAsJson.basket, expectedUpdateRep.basket);
                assert.containSubset(bodyAsJson.basket.totals, expectedUpdateRep.basket.totals);
                assert.equal(bodyAsJson.basket.items.length, expectedUpdateRep.basket.items.length);
            });
    });
});
