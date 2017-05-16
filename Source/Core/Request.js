/*global define*/
define([
        './defaultValue',
        './defined',
        './defineProperties',
        './RequestType'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        RequestType) {
    'use strict';

    /**
     * Stores information for making a request using {@link RequestScheduler}.
     *
     * @exports Request
     *
     * @private
     */
    function Request(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        /**
         * The URL to request.
         */
        this.url = options.url;

        /**
         * The actual function that makes the request. Returns a promise for the requested data.
         */
        this.requestFunction = options.requestFunction;

        /**
         * Type of request. Used for more fine-grained priority sorting.
         */
        this.type = defaultValue(options.type, RequestType.OTHER);

        /**
         * If false, the request will be sent immediately. If true, the request will be throttled and sent based
         * on priority.
         */
        this.throttle = defaultValue(options.throttle, false);

        /**
         * The distance from the camera, used to prioritize requests.
         */
        this.distance = defaultValue(options.distance, 0.0);

        /**
         * The screen-space-error, used to prioritize requests.
         */
        this.screenSpaceError = defaultValue(options.screenSpaceError, 0.0);

        this.cancel = false;
        this.done = false;
        this.xhr = undefined;
        this._promise = undefined;
    }

    defineProperties(Request.prototype, {
        /**
         * Promise that resolves with the requested data.
         *
         * @memberof Request.prototype
         *
         * @type {Promise}
         * @readonly
         */
        promise : {
            get : function() {
                return this._promise.promise;
            }
        }
    });

    console.log('XHR abort is supported: ' + xhrAbortSupported);

    return Request;
});
