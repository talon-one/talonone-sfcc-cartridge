var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Edit ProductLineItem', function () {
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


    it('should update product line item with the new variant and quantity', function () {
        // edit attributes of product variant
        var newQty = 3;
        var newTotalQty = newQty + qty;

        var newVariantPid = '701642923541M';   // 3/4 Sleeve V-Neck Top: Grey Heather, S

        myRequest.method = 'POST';
        myRequest.url = config.baseUrl + '/Cart-EditProductLineItem';
        myRequest.form = {
            uuid: variantUuid,
            pid: newVariantPid,
            quantity: newQty
        };

        var expectedUpdateRep = {
            'action': 'Cart-EditProductLineItem',
            'cartModel': {
                'totals': {
                    'subTotal': '$72.00'
                },
                'items': [
                    {
                        'id': newVariantPid,
                        'productName': '3/4 Sleeve V-Neck Top',
                        'price': {
                            'sales': {
                                'currency': 'USD',
                                'value': 24,
                                'formatted': '$24.00',
                                'decimalPrice': '24.00'
                            }
                        },
                        'images': {
                            'small': [
                                {
                                    'alt': '3/4 Sleeve V-Neck Top, Grey Heather, small',
                                    'title': '3/4 Sleeve V-Neck Top, Grey Heather'
                                }
                            ]
                        },
                        'variationAttributes': [
                            {
                                'displayName': 'Color',
                                'displayValue': 'Grey Heather',
                                'attributeId': 'color'
                            },
                            {
                                'displayName': 'Size',
                                'displayValue': 'S',
                                'attributeId': 'size'
                            }
                        ],
                        'availability': {
                            'messages': [
                                'In Stock'
                            ],
                            'inStockDate': null
                        },
                        'UUID': variantUuid,
                        'quantity': newQty,
                        'priceTotal': {
                            'price': '$72.00'
                        }
                    }
                ],
                'numItems': newTotalQty,
                'locale': 'en_US',
                'resources': {
                    'numberOfItems': newTotalQty + ' Items',
                    'emptyCartMsg': 'Your Shopping Cart is Empty'
                }
            },
            'newProductId': newVariantPid
        };

        return request(myRequest)
            .then(function (updateResponse) {
                assert.equal(updateResponse.statusCode, 200, 'Expected statusCode to be 200.');

                var bodyAsJson = JSON.parse(updateResponse.body);
                assert.containSubset(bodyAsJson.cartModel.totals, expectedUpdateRep.cartModel.totals);
                assert.equal(bodyAsJson.cartModel.items.length, expectedUpdateRep.cartModel.items.length);
                assert.containSubset(bodyAsJson.cartModel.items, expectedUpdateRep.cartModel.items);
            });
    });
});
