var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Add coupon', function () {
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

    var couponCode;

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

    it('should return error when you try to add internal coupon', function () {
        myRequest.url = config.baseUrl + '/CSRF-Generate';
        couponCode = 'K75VV55';

        return request(myRequest)
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);

                myRequest.url = config.baseUrl + '/Cart-AddCoupon?couponCode=' + couponCode + '&' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.method = 'GET';

                return request(myRequest)
                    .then(function (response) {
                        var bodyAsJson = JSON.parse(response.body);

                        var expectedResult = {
                            error: true,
                            errorMessage: 'Coupon cannot be added to your cart'
                        };

                        assert.equal(bodyAsJson.error, expectedResult.error);
                        assert.equal(bodyAsJson.errorMessage, expectedResult.errorMessage);
                    });
            });
    });

    it('should add coupon to basket', function () {
        myRequest.url = config.baseUrl + '/CSRF-Generate';
        myRequest.method = 'POST';
        couponCode = 'K75VV55K';

        return request(myRequest)
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);

                myRequest.url = config.baseUrl + '/Cart-AddCoupon?couponCode=' + couponCode + '&' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.method = 'GET';

                return request(myRequest)
                    .then(function (response) {
                        assert.equal(response.statusCode, 200, 'Expected add coupon request statusCode to be 200.');
                        var bodyAsJson = JSON.parse(response.body);
                        var expectedResBody = {
                            'totals': {
                                'discounts': [
                                    {
                                        'type': 'coupon',
                                        'couponCode': 'K75VV55K',
                                        'applied': true,
                                        'valid': true,
                                        'relationship': [
                                            {
                                                'callOutMsg': '10% discount on session total'
                                            }
                                        ]
                                    }
                                ]
                            }
                        };

                        assert.containSubset(bodyAsJson, expectedResBody);
                    });
            });
    });
});
