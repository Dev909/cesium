/*global define*/
define([
        './defined'
    ], function(
        defined) {
    'use strict';

    var blobUriRegex = /^blob:/i;

    /**
     * Determines if the specified uri is a blob uri.
     *
     * @exports isBlobUri
     *
     * @param {String} uri The uri to test.
     * @returns {Boolean} true when the uri is a blob uri; otherwise, false.
     *
     * @private
     */
    function isBlobUri(uri) {
        if (defined(uri)) {
            return blobUriRegex.test(uri);
        }

        return false;
    }

    return isBlobUri;
});
