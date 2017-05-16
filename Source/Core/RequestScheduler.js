/*global define*/
define([
        './Check',
        './defined',
        './defineProperties',
        './Heap',
        './isBlobUri',
        './isDataUri',
        '../ThirdParty/when'
    ], function(
        Check,
        defined,
        defineProperties,
        Heap,
        isBlobUri,
        isDataUri,
        when) {
    'use strict';

    function sortRequests(a, b) {
        // Sort requests by higher screen space error and then closer distance
        if (a.screenSpaceError !== b.screenSpaceError) {
            return b.screenSpaceError - a.screenSpaceError;
        }
        return a.distance - b.distance;
    }

    var stats = {
        numberOfRequestsThisFrame : 0
    };

    var maximumRequests = 0;
    var requestHeap = new Heap(sortRequests);
    var activeRequests = [];

    /**
     * Tracks the number of active requests in progress and prioritize incoming requests.
     *
     * @exports RequestScheduler
     *
     * @private
     */
    function RequestScheduler() {
    }

    defineProperties(RequestScheduler, {
        /**
         * Specifies the maximum number of requests that can be simultaneously open.
         *
         * @memberof RequestScheduler
         * @type {Number}
         * @default 50
         */
        maximumRequests : {
            get : function() {
                return maximumRequests;
            },
            set : function(value) {
                maximumRequests = value;
                requestHeap.maximumSize = value;
            }
        }
    });

    RequestScheduler.maximumRequests = 50;

    /**
     * Specifies if the request scheduler should throttle incoming requests, or let the browser queue requests under its control.
     * @type {Boolean}
     * @default true
     */
    RequestScheduler.throttle = true;

    /**
     * When true, log statistics to the console every frame
     * @type {Boolean}
     * @default false
     */
    RequestScheduler.debugShowStatistics = false;

    RequestScheduler.clearForSpecs = function() {
        // TODO - remove
    };

    function startRequest(request) {
        request.requestFunction().then(function(results) {
            request.promise.resolve(results);
            request.done = true;
        }).otherwise(function(error) {
            request.promise.reject(error);
        });
        activeRequests.push(request);
    }

    /**
     * Issuers of a request should update properties of requests. At the end of the frame,
     * RequestScheduler.update is called to issue / reschedule / defer / cancel requests.
     */
    RequestScheduler.update = function() {
        showStats();
        clearStats();

        if (!RequestScheduler.throttle) {
            return;
        }

        var request;

        // Loop over all active requests. Cancelled or completed requests are removed from the array to make room for new requests.
        var completedCount = 0;
        var activeLength = activeRequests.length;
        for (var i = 0; i < activeLength; ++i) {
            request = activeRequests[i];
            if (request.cancel) {
                // Active request was cancelled. Try to abort the XMLHttpRequest.
                ++completedCount;
                request.promise.reject();
                if (xhrAbortSupported && defined(request.xhr)) {
                    request.xhr.abort();
                }
                continue;
            } else if (request.done) {
                ++completedCount;
                continue;
            }
            if (completedCount > 0) {
                // Shift back to fill in vacated slots from completed requests
                activeRequests[i - completedCount] = request;
            }
        }
        activeRequests.length -= completedCount;

        // Resort the heap since priority may have changed. Distance and sse are updated prior to getting here.
        requestHeap.reserve();
        requestHeap.rebuild();

        // Get the number of open slots and request the highest priority requests
        var openSlots = maximumRequests - activeRequests.length;
        var count = 0;
        while (count < openSlots && requestHeap.length > 0) {
            request = requestHeap.pop();
            if (request.cancel) {
                // Request was cancelled before it became active
                request.promise.reject();
                continue;
            }
            startRequest(request);
            ++count;
        }
    };

    /**
     * Issue a request. If request.throttle is false, the request is sent immediately. Otherwise the request will be
     * queued and sorted by priority before being sent.
     *
     * @param {Request} request The request object.
     *
     * @returns {Promise|undefined} A Promise for the requested data, or undefined if there are too many active requests.
     */
    RequestScheduler.request = function(request) {
        //>>includeStart('debug', pragmas.debug);
        Check.defined('request', request);
        //>>includeEnd('debug');

        ++stats.numberOfRequestsThisFrame;

        if (!RequestScheduler.throttle || !request.throttle || isDataUri(request.url) || isBlobUri(request.url)) {
            return request.requestFunction();
        }

        var inserted = requestHeap.insert(request);
        if (!inserted) {
            return undefined;
        }

        request._promise = when.defer();
        return request.promise;
    };

    function clearStats() {
        stats.numberOfRequestsThisFrame = 0;
    }

    function showStats() {
        if (!RequestScheduler.debugShowStatistics) {
            return;
        }

        if (stats.numberOfRequestsThisFrame > 0) {
            console.log('Number of requests attempted: ' + stats.numberOfRequestsThisFrame);
        }

        // TODO : console.log number of active requests
    }

    var xhrAbortSupported = (function() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', '#', true);
            xhr.send();
            xhr.abort();
            return (xhr.readyState === XMLHttpRequest.UNSENT);
        } catch (e) {
            return false;
        }
    })();

    return RequestScheduler;
});
