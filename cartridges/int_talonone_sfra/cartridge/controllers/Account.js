'use strict';

var server = require('server');

var page = module.superModule;

server.extend(page);


server.append('SubmitRegistration',

    function (req, res, next) {
        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            // Talonone - Begin: Calling talonone services for (Registration)
            if (res.viewData.success) {
                var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
                talonOneHelper.createCustomerProfile(req.locale.id);
            }
            // Talonone - End: Calling talonone services for (Registration)
        });
        next();
    }

);


server.append('Login',

    function (req, res, next) {
        // Talonone - Begin: Calling talonone services for (Login)
        if (res.viewData.success) {
            var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
            talonOneHelper.createCustomerProfile(req.locale.id);
        }
        // Talonone - End: Calling talonone services for (Login)
        next();
    }

);


server.append('SaveProfile',

    function (req, res, next) {
        // Talonone - Begin: Calling talonone services for (Update Profile)
        this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
            if (res.viewData.success) {
                var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
                talonOneHelper.createCustomerProfile(req.locale.id);
            }
        });
        // Talonone - End: Calling talonone services for (Update Profile)
        next();
    }

);

module.exports = server.exports();
