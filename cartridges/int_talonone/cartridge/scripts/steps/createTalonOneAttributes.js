'use strict';

var Status = require('dw/system/Status');

/**
 * Run create attribute service.
 * @return {Object} Status value.
 */
function createAttributes() {
    var talonOneServiceWrapper = require('*/cartridge/scripts/util/talonOneServiceWrapper');
    var attributes = talonOneServiceWrapper.createAttributes();
    try {
        if (attributes.error === true) {
            return new Status(Status.ERROR);
        }
    } catch (e) {
        return new Status(Status.ERROR);
    }
    return new Status(Status.OK);
}


module.exports = {
    createAttributes: createAttributes
};
