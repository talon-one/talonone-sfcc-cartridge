var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('Place Order', function () {
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

    it('should returns an error status while placing an order', function () {
        myRequest.url = config.baseUrl + '/CSRF-Generate';

        return request(myRequest)
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);

                myRequest.url = config.baseUrl + '/CheckoutServices-PlaceOrder?' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;

                return request(myRequest)
                    .then(function (response) {
                        assert.equal(response.statusCode, 200, 'Expected statusCode to be 500.');
                        var bodyAsJson = JSON.parse(response.body);

                        var expectedResult = {
                            error: true
                        };

                        assert.equal(bodyAsJson.error, expectedResult.error);
                    });
            });
    });
});
