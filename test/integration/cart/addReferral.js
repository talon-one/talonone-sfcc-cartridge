var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Add Referral', function () {
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

    var referralCode;

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

    it('should return error when you try to add referral code', function () {
        myRequest.url = config.baseUrl + '/CSRF-Generate';
        referralCode = 'REFERRALC20';

        return request(myRequest)
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);

                myRequest.url = config.baseUrl + '/Cart-AddReferral?referralCode=' + referralCode + '&' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.method = 'GET';

                return request(myRequest)
                    .then(function (response) {
                        var bodyAsJson = JSON.parse(response.body);

                        var expectedResult = {
                            error: true
                        };

                        assert.equal(bodyAsJson.error, expectedResult.error);
                    });
            });
    });

    it('should add referral to basket', function () {
        myRequest.url = config.baseUrl + '/CSRF-Generate';
        myRequest.method = 'POST';
        referralCode = 'REFERRALD20';

        return request(myRequest)
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);

                myRequest.url = config.baseUrl + '/Cart-AddReferral?referralCode=' + referralCode + '&' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.method = 'GET';

                return request(myRequest)
                    .then(function (response) {
                        assert.equal(response.statusCode, 200, 'Expected add referral request statusCode to be 200.');
                        var bodyAsJson = JSON.parse(response.body);
                        var expectedResBody = {
                            error: false,
                            message: 'Referral code successfully applied (10% Off)'
                        };

                        assert.containSubset(bodyAsJson, expectedResBody);
                    });
            });
    });
});
