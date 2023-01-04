'use strict';

var server = require('server');

var page = module.superModule;

server.extend(page);

server.append('CreateAccount',

    function (req, res, next) {
        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            // Talonone - Begin: Calling talonone services for (Save Address)
            if (res.viewData.success) {
                var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
                talonOneHelper.createCustomerProfile(req.locale.id);
            }
            // Talonone - End: Calling talonone services for (Save Address)
        });
        next();
    }
);

server.append('Confirm',

    function (req, res, next) {
        var viewData = res.getViewData();
        // Talonone - Start:
        var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
        var OrderMgr = require('dw/order/OrderMgr');
        var referralCode;
        if (req.form.orderToken && req.form.orderID) {
            referralCode = OrderMgr.getOrder(req.form.orderID, req.form.orderToken).custom.referralCode;
        }
        viewData.talon = talonOneHelper.talonConfig(true, '', referralCode);
        // Talonone - End:
        res.setViewData(viewData);
        next();
    }
);

module.exports = server.exports();
