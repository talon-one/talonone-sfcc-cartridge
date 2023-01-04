'use strict';

var server = require('server');
server.extend(module.superModule);

server.append('PlaceOrder', server.middleware.https, function (req, res, next) {
    var viewData = res.getViewData();
    var OrderMgr = require('dw/order/OrderMgr');
    var order;

    // Talonone - Begin: Calling the talonone customer session on closed state
    if (viewData.orderID && viewData.orderToken) {
        var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');

        order = OrderMgr.getOrder(viewData.orderID, viewData.orderToken);
        talonOneHelper.updateCloseOrderSession(order);
    }
    // Talonone - End:  Calling the talonone customer session on closed state

    next();
});

server.append('LoginCustomer', function (req, res, next) {
    // Talonone - Begin: Calling talonone services for (Chekout Login)
    if (!res.viewData.error) {
        var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
        talonOneHelper.createCustomerProfile(req.locale.id);
    }
    // Talonone - End: Calling talonone services for (Chekout Login)
    next();
}
);

module.exports = server.exports();

