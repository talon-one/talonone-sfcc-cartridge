var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

describe('Remove coupon lineitem', function () {
    this.timeout(5000);

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

    var uuid;

    var variantPid = '701643421084M';
    var qty = 1;
    var addProduct = '/Cart-AddProduct';

    myRequest.url = config.baseUrl + addProduct;
    myRequest.form = {
        pid: variantPid,
        quantity: qty
    };

    before(function () {
        return request(myRequest)
            .then(function (addToCartResponse) {
                assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
            });
    });

    it('should return error when you try to remove invalid couponlineitem', function () {
        uuid = '8dcc22d4f55b8825dfed11a446';
        myRequest.url = config.baseUrl + '/Cart-RemoveCouponLineItem?uuid=' + uuid;
        myRequest.method = 'GET';

        return request(myRequest)
            .then(function () {})
            .catch(function (err) {
                var bodyAsJson = JSON.parse(err.response.body);
                var expectedResult = {
                    errorMessage: 'Unable to remove coupon from the cart. Please try again! If the issue continues please contact customer service.'
                };
                assert.equal(bodyAsJson.errorMessage, expectedResult.errorMessage);
                assert.equal(err.statusCode, 500, 'Expected statusCode to be 500 for removing coupon line item with non-matching UUID.');
            });
    });
});
