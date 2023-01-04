/* globals empty */

'use strict';
var Site = require('dw/system/Site');
var ArrayList = require('dw/util/ArrayList');
var talonOnePreferences = {};

/**
 * To check talonone is enabled or not.
 * @return {boolean} value.
 */
talonOnePreferences.isEnabled = function () {
    return Site.getCurrent().getCustomPreferenceValue('isTalonOneEnabled');
};

/**
 * To get the API key prefix.
 * @return {string} The Talonone API key prefix.
 */
talonOnePreferences.getAPIKeyPrefix = function () {
    var APIprefix = Site.getCurrent().getCustomPreferenceValue('API_key_prefix');
    APIprefix = (APIprefix.value !== null) ? APIprefix.value : '';
    return APIprefix;
};

/**
 * To get the API key.
 * @return {string} The Talonone API key.
 */
talonOnePreferences.getAPIKey = function () {
    var APIkey = Site.getCurrent().getCustomPreferenceValue('API_Key');
    APIkey = (APIkey !== null) ? APIkey : '';
    return APIkey;
};

/**
 * To get the Profile UUID key prefix.
 * @return {string} The Talonone Profile UUID key prefix.
 */
talonOnePreferences.getProfileUUIDPrefix = function () {
    var profileIDPrefix = Site.getCurrent().getCustomPreferenceValue('profile_id_prefix');
    profileIDPrefix = (profileIDPrefix.value !== null) ? profileIDPrefix.value : '';
    return profileIDPrefix;
};

/**
 * To get the attribute value.
 * @return {string} Attribute value.
 */
talonOnePreferences.getAttributeValues = function () {
    var productAttr = Site.getCurrent().getCustomPreferenceValue('productAttributes');

    if (!empty(productAttr)) {
        return new ArrayList(productAttr).toArray();
    }

    return '';
};


/**
 * To fetch dynamic attributes object.
 * @return {Object} value.
 */
talonOnePreferences.fetchAttributesObject = function () {
    return Site.getCurrent().getCustomPreferenceValue('talonOneAttributeObjects');
};

/**
 * To check whether loyalty feature is enabled or not.
 * @return {boolean} value.
 */
talonOnePreferences.isLoyaltyEnabled = function () {
    return Site.getCurrent().getCustomPreferenceValue('isLoyalPointsEnabled');
};

/**

 * To check referral is enabled or not.

 * @return {boolean} value.

 */

talonOnePreferences.isReferralEnabled = function () {
    return Site.getCurrent().getCustomPreferenceValue('isReferralCodeEnabled');
};


module.exports = talonOnePreferences;
