'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var Money = require('../../../mocks/dw.value.Money');
var ArrayList = require('../../../mocks/dw.util.Collection');
var baseTotals = require('../../../mocks/models/totals');
var mockSuperModule = require('../../../mocks/superModule');


var createApiBasket = function (isAvailable) {
    return {
        totalGrossPrice: new Money(isAvailable),
        totalTax: new Money(isAvailable),
        shippingTotalPrice: new Money(isAvailable),
        getAdjustedMerchandizeTotalPrice: function () {
            return new Money(isAvailable);
        },
        adjustedShippingTotalPrice: new Money(isAvailable),
        couponLineItems: new ArrayList([
            {
                UUID: 1234567890,
                couponCode: 'some coupon code',
                applied: true,
                valid: true,
                priceAdjustments: new ArrayList([{
                    promotion: { calloutMsg: 'some call out message' },
                    custom: { talonOnePromotionRuleName: 'some rule name' }
                }])
            }
        ]),
        custom: {},
        priceAdjustments: new ArrayList([{
            UUID: 10987654321,
            calloutMsg: 'some call out message',
            basedOnCoupon: false,
            price: { value: 'some value', currencyCode: 'usd' },
            lineItemText: 'someString',
            promotion: { calloutMsg: 'some call out message' }
        },
        {
            UUID: 10987654322,
            calloutMsg: 'price adjustment without promotion msg',
            basedOnCoupon: false,
            price: { value: 'some value', currencyCode: 'usd' },
            lineItemText: 'someString'
        }]),
        allShippingPriceAdjustments: new ArrayList([{
            UUID: 12029384756,
            calloutMsg: 'some call out message',
            basedOnCoupon: false,
            price: { value: 'some value', currencyCode: 'usd' },
            lineItemText: 'someString',
            promotion: { calloutMsg: 'some call out message' }
        }])
    };
};

describe('Totals', function () {
    before(function () {
        mockSuperModule.create(baseTotals);
    });
    var Totals;
    beforeEach(function () {
        Totals = proxyquire('../../../../cartridges/int_talonone_sfra/cartridge/models/totals', {
            'dw/util/StringUtils': {
                formatMoney: function () {
                    return 'formatted money';
                }
            },
            'dw/value/Money': Money,
            'dw/util/Template': function () {
                return {
                    render: function () {
                        return { text: 'someString' };
                    }
                };
            },
            'dw/util/HashMap': function () {
                return {
                    result: {},
                    put: function (key, context) {
                        this.result[key] = context;
                    }
                };
            },
            '*/cartridge/scripts/util/collections': require('../../../mocks/util/collections'),
            '*/cartridge/scripts/util/talonOnePreferences': require('../../../mocks/util/talonOnePreferences')
        });
    });
    it('should get discounts', function () {
        var result = new Totals(createApiBasket(true));
        assert.equal(result.discounts.length, 4);
        assert.equal(result.discounts[0].UUID, 1234567890);
        assert.equal(result.discounts[0].type, 'coupon');
        assert.equal(result.discounts[0].applied, true);
        assert.equal(result.discounts[1].type, 'promotion');
        assert.equal(result.discounts[1].callOutMsg, 'some call out message');
        assert.equal(result.discounts[1].UUID, 10987654321);
        assert.equal(result.discounts[2].UUID, 10987654322);
        assert.equal(result.discounts[3].UUID, 12029384756);
    });
});
