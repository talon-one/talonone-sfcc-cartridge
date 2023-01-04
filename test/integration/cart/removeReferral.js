var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');

describe('Remove referrals', function () {
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

    it('should remove referral code from basket', function () {
        myRequest.url = config.baseUrl + '/Cart-removeReferral';
        myRequest.method = 'GET';

        return request(myRequest)
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected statusCode to be 200 for removing referral code');
            });
    });
});
