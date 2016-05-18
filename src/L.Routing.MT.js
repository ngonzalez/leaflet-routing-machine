(function() {
  'use strict';

  var L = require('leaflet'),
    corslite = require('corslite'),
    polyline = require('polyline');

  /* jshint camelcase: false */

  L.Routing = L.Routing || {};
  L.extend(L.Routing, require('./L.Routing.Waypoint'));

  L.Routing.MT = L.Class.extend({
    options: {
      timeout: 30 * 1000,
      polylinePrecision: 5
    },

    initialize: function(options) {
      L.Util.setOptions(this, options);
      this._hints = {
        locations: {}
      };
    },

    route: function(waypoints, callback, context, options) {
      var timedOut = false,
        wps = [],
        url,
        timer,
        wp,
        i;

      url = this.buildRouteUrl(waypoints);

      timer = setTimeout(function() {
        timedOut = true;
        callback.call(context || callback, {
          status: -1,
          message: 'Request timed out.'
        });
      }, this.options.timeout);

      // Create a copy of the waypoints, since they
      // might otherwise be asynchronously modified while
      // the request is being processed.
      for (i = 0; i < waypoints.length; i++) {
        wp = waypoints[i];
        wps.push(new L.Routing.Waypoint(wp.latLng, wp.name, wp.options));
      }

      corslite(url, L.bind(function(err, resp) {
        var data,
          errorMessage,
          statusCode;

        clearTimeout(timer);
        if (!timedOut) {
          errorMessage = 'HTTP request failed: ' + err;
          statusCode = -1;

          if (!err) {
            try {
              data = JSON.parse(resp.responseText);
              try {
                return this._routeDone(data, wps, options, callback, context);
              } catch (ex) {
                statusCode = -3;
                errorMessage = ex.toString();
              }
            } catch (ex) {
              statusCode = -2;
              errorMessage = 'Error parsing response: ' + ex.toString();
            }
          }

          callback.call(context || callback, {
            status: statusCode,
            message: errorMessage
          });
        }
      }, this));

      return this;
    },

    _routeDone: function(response, inputWaypoints, options, callback, context) {
      var alts = [],
          actualWaypoints,
          i,
          route;

      context = context || callback;

      for (i=0; i<response.features.length; i++) {
        route = this._convertRoute(response.features[i]);
        route.inputWaypoints = inputWaypoints;
        route.waypoints = actualWaypoints;
        alts.push(route);
      }

      callback.call(context, null, alts);
    },

    _convertRoute: function(responseRoute) {
      var result = {
          name: '', // TODO
          summary: {
            totalDistance: responseRoute.properties.router.total_distance,
            totalTime: responseRoute.properties.router.total_time
          }
        },
        coordinates = [],
        instructions = [],
        i;

      var coordinates = responseRoute.geometry.coordinates;
      var result, i;

      for (i=coordinates.length - 1; i>=0; i--) {
        coordinates[i] = L.latLng([coordinates[i][1], coordinates[i][0]]);
      }

      result.coordinates = Array.prototype.concat.apply([], coordinates);
      result.instructions = instructions;

      return result;
    },

    buildRouteUrl: function(waypoints) {
      var wp, locs = [];
      for (var i=0; i<waypoints.length; i++) {
        wp = waypoints[i];
        locs.push([wp.latLng.lat, wp.latLng.lng].join(','));
      }
      return this.options.serviceUrl + '/route.geojson?api_key=' + this.options.apiKey +
        '&mode=' + this.options.mode + '&dimension=' + this.options.dimension +
        '&geometry=true&loc=' + locs.join(',')
    }
  });

  L.Routing.mt = function(options) {
    return new L.Routing.MT(options);
  };

  module.exports = L.Routing;
})();
