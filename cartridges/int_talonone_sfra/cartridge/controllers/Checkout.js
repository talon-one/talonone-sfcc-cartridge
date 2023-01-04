'use strict';

var server = require('server');
var page = module.superModule;
server.extend(page);

server.append('Begin',
    function (req, res, next) {
        var viewData = res.getViewData();
        // Talonone - Start:
        var talonOneHelper = require('*/cartridge/scripts/helper/talonOneHelper');
        viewData.talon = talonOneHelper.talonConfig(false, '', '');
        // Talonone- End:

        res.setViewData(viewData);
        next();
    }
);

module.exports = server.exports();
