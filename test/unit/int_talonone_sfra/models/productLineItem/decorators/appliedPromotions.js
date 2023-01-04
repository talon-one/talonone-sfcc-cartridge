'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var ArrayList = require('../../../../../mocks/dw.util.Collection');

describe('product line item applied promotions decorator', function () {
    var collections = proxyquire('../../../../../mocks/util/collections', {
        'dw/util/ArrayList': ArrayList
    });

    var talonOnePreferences = proxyquire('../../../../../mocks/util/talonOnePreferences', {});

    var appliedPromotions = proxyquire('../../../../../../cartridges/int_talonone_sfra/cartridge/models/productLineItem/decorators/appliedPromotions', {
        '*/cartridge/scripts/util/collections': collections,
        '*/cartridge/scripts/util/talonOnePreferences': talonOnePreferences,
        'dw/web/Resource': { msg: function () { return 'test discount'; } }
    });

    it('should create a property on the passed in object called appliedPromotions', function () {
        var object = {};

        var promotionMock = {
            promotion: {
                calloutMsg: {
                    markup: 'someCallOutMsg'
                },
                name: 'somePromotionName',
                details: {
                    markup: 'someDetails'
                }
            },
            custom: {
                talonOnePromotionRuleName: 'somePromotionName'
            }
        };

        var lineItemMock = { priceAdjustments: new ArrayList([promotionMock]) };
        appliedPromotions(object, lineItemMock);

        assert.equal(object.appliedPromotions.length, 1);
        assert.equal(object.appliedPromotions[0].callOutMsg, 'somePromotionName');
        if (object.appliedPromotions[0].name) {
            assert.equal(object.appliedPromotions[0].name, 'somePromotionName');
        }
        if (object.appliedPromotions[0].name) {
            assert.equal(object.appliedPromotions[0].details, 'someDetails');
        }
    });
});
