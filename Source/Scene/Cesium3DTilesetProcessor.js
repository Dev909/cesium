/*global define*/
define([
        '../Core/defined',
        './Cesium3DTileContentState',
        './CullingVolume'
    ], function(
        defined,
        Cesium3DTileContentState,
        CullingVolume) {
    'use strict';

    /**
     * @private
     */
    function Cesium3DTilesetProcessor() {
    }

    Cesium3DTilesetProcessor.processTiles = function(tileset, frameState) {
        var i;
        var tile;
        var tiles = tileset._processingHeap;
        var internalArray = tiles.internalArray;

        var start = Date.now();
        var timeSlice = 15; // ms

        // Resize and rebuild
        tiles.reserve();
        tiles.rebuild();

        var internalLength = internalArray.length;
        var popCount = 0;

        while (tiles.length > 0 && (Date.now() - start <= timeSlice)) {
            // Pop tiles and use the back of the array as scratch space
            tile = tiles.pop();
            ++popCount;
            internalArray[internalLength - popCount] = tile;
            tile.process(tileset, frameState);
        }

        // Insert any tiles still processing back into the processing heap
        for (i = internalLength - popCount; i < internalLength; ++i) {
            tile = tiles.internalArray[i];
            internalArray[i] = undefined;
            if (tile.contentProcessing) {
                tiles.insert(tile);
            }
        }
    };

    Cesium3DTilesetProcessor.requestContent = function(tileset, tile, outOfCore) {
        if (!outOfCore) {
            return;
        }

        if (tile.hasEmptyContent) {
            return;
        }

        var statistics = tileset._statistics;
        var expired = tile.contentExpired;
        var requested = tile.requestContent();

        if (!requested) {
            ++statistics.numberOfAttemptedRequests;
            return;
        }

        if (expired) {
            if (tile.hasRenderableContent) {
                statistics.decrementLoadCounts(tile.content);
                --tileset._statistics.numberContentReady;
            } else if (tile.hasTilesetContent) {
                tileset.destroySubtree(tile);
            }
        }

        tileset._requestingTiles.push(tile);

        ++statistics.numberOfPendingRequests;

        var removeFunction = removeFromProcessingQueue(tileset, tile);
        tile.contentReadyToProcessPromise.then(addToProcessingQueue(tileset, tile));
        tile.contentReadyPromise.then(removeFunction).otherwise(removeFunction);
    };

    Cesium3DTilesetProcessor.updateRequestingTiles = function(tileset, frameState) {
        var statistics = tileset.statistics;
        var tiles = tileset._requestingTiles.internalArray;
        var length = tileset._requestingTiles.length;
        var undefinedCount = 0;
        // Stream compact the array. Tiles that are done have been set to undefined. Update any tiles still requesting.
        for (var i = 0; i < length; ++i) {
            var tile = tiles[i];
            if (!defined(tile)) {
                ++undefinedCount;
                continue;
            } else if (!defined(tile._request)) {
                console.log("TODO HERE MAY BE NOT CALLED EVER");
                tiles[i] = undefined;
                ++undefinedCount;
                continue;
            }

            if (undefinedCount > 0) {
                tiles[i - undefinedCount] = tile;
            }

            if (tile._lastVisitedFrame !== frameState.frameNumber) {
                // This tile was not seen this frame. Cancel the request
                --statistics.numberOfPendingRequests;
                ++statistics.numberOfCancelledRequests;

                tile._request.cancel();
                tile.unloadContent();
                tile._request = undefined;
                tiles[i] = undefined;
                ++undefinedCount;
                continue;
            }

            // Update parameters for request sorting
            tile._request.screenSpaceError = tile._screenSpaceError;
            tile._request.distance = tile._distanceToCamera;
        }
        tileset._requestingTiles.length -= undefinedCount;
        tileset._requestingTiles.trim();
    };

    function addToProcessingQueue(tileset, tile) {
        return function() {
            // Remove tile from requestingTiles. Mark as undefined for now and stream compact in updateRequestingTiles.
            var requestingTiles = tileset._requestingTiles.internalArray;
            var index = requestingTiles.indexOf(tile);
            if (index >= 0) {
                requestingTiles[index] = undefined;
            }

            tileset._processingHeap.insert(tile);

            --tileset._statistics.numberOfPendingRequests;
            ++tileset._statistics.numberProcessing;
        };
    }

    function removeFromProcessingQueue(tileset, tile) {
        return function() {
            var processingHeap = tileset._processingHeap;
            var internalArray = processingHeap.internalArray;
            var index = internalArray.indexOf(tile);
            if (index >= 0) {
                // Remove from processing queue. processTiles may have already removed the tile.
                if (index < processingHeap.length) {
                    processingHeap.pop(index);
                }

                --tileset._statistics.numberProcessing;

                if (tile.hasRenderableContent) {
                    // RESEARCH_IDEA: ability to unload tiles (without content) for an
                    // external tileset when all the tiles are unloaded.
                    tileset._statistics.incrementLoadCounts(tile.content);
                    ++tileset._statistics.numberContentReady;

                    // Add to the tile cache. Previously expired tiles are already in the cache.
                    if (!defined(tile.replacementNode)) {
                        tile.replacementNode = tileset._replacementList.add(tile);
                    }
                }
            } else {
                // Not in processing queue
                // For example, when a url request fails and the ready promise is rejected
                --tileset._statistics.numberOfPendingRequests;
            }
        };
    }

    return Cesium3DTilesetProcessor;
});
