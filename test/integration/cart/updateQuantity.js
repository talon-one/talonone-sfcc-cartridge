var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Update Quantity', function () {
    this.timeout(45000);

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


    it('should update product line item quantity', function () {
        // update qty of product variant
        var newQty = 5;

        myRequest.method = 'GET';
        myRequest.url = config.baseUrl + '/Cart-UpdateQuantity?pid=' + variantPid +
            '&quantity=' + newQty +
            '&uuid=' + variantUuid;


        var expectedUpdateRep = {
            'action': 'Cart-UpdateQuantity',
            'totals': {
                'subTotal': '$120.00'
            },
            'items': [
                {
                    'id': variantPid,
                    'productName': '3/4 Sleeve V-Neck Top',
                    'price': {
                        'sales': {
                            'currency': 'USD',
                            'value': 24
                        }
                    },
                    'variationAttributes': [
                        {
                            'displayName': 'Color',
                            'displayValue': 'Icy Mint'
                        },
                        {
                            'displayName': 'Size',
                            'displayValue': 'XS'
                        }
                    ],
                    'UUID': variantUuid,
                    'quantity': newQty
                }
            ],
            'numItems': newQty,
            'locale': 'en_US',
            'resources': {
                'numberOfItems': newQty + ' Items',
                'emptyCartMsg': 'Your Shopping Cart is Empty'
            }
        };

        return request(myRequest)
            .then(function (updateResponse) {
                assert.equal(updateResponse.statusCode, 200, 'Expected statusCode to be 200.');

                var bodyAsJson = JSON.parse(updateResponse.body);
                assert.containSubset(bodyAsJson.totals, expectedUpdateRep.totals);
                assert.equal(bodyAsJson.items.length, expectedUpdateRep.items.length);
                assert.containSubset(bodyAsJson.items, expectedUpdateRep.items);
            });
    });
});
