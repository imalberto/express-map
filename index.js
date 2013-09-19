'use strict';

var annotations = require('express-annotations'),
    methods     = require('methods'),

    pathTo = require('./lib/pathto');

exports.extend = extendApp;
exports.pathTo = pathTo;

function extendApp(app) {
    if (app['@map']) { return app; }

    // Add Express Annotations support to the `app`.
    annotations.extend(app);

    // Brand.
    Object.defineProperty(app, '@map', {value: true});

    app.map            = mapRoute;
    app.getRouteMap    = getRouteMap;
    app.getRouteParams = getRouteParams;

    // Sets up registry for simple param handlers that are either regular
    // expressions or basic, non-middleware functions. These param handlers are
    // exposed along with the exposed routes.
    app.params = {};
    app.param(registerParam.bind(app));

    return app;
}

// TODO: Should this accept an object of mappings? If so what should be the key,
// and what should be the value?
function mapRoute(routePath, name) {
    /* jshint validthis:true */
    var annotations = this.annotations[routePath],
        names       = ((annotations && annotations.names) || []).concat(name);

    name = (annotations && annotations.name) ||
            (Array.isArray(name) ? name[0] : name);

    return this.annotate(routePath, {
        // Annotate with a singular name, either existing or new.
        name: name,

        // Annotate with a unique set of names.
        names: Object.keys(names.reduce(function (unique, name) {
            if (name) { unique[name] = true; }
            return unique;
        }, {}))
    });
}

function getRouteMap(annotations) {
    /* jshint validthis:true */
    if (!Array.isArray(annotations)) {
        annotations = [].slice.call(arguments);
    }

    // Gather all mapped/named routePaths that have the specified `annotations`.
    var appAnnotations = this.annotations,
        routes         = this.findAll(annotations.concat('name'));

    // Creates a mapping of name -> route object. The route objects are shallow
    // copies of a route's primary metadata.
    return methods.reduce(function (map, method) {
        var methodRoutes = routes[method];

        if (!methodRoutes) { return map; }

        methodRoutes.forEach(function (route) {
            var pathAnnotations = appAnnotations[route.path],
                name            = pathAnnotations.name,
                entry;

            // Return early if the route has no canonical `name`, or if that
            // name has already been mapped, in which case none of its `names`
            // will be mapped.
            if (!name || map[name]) { return; }

            // The entry that represents the route in the route map.
            entry = {
                path       : route.path,
                keys       : route.keys,
                regexp     : route.regexp,
                annotations: appAnnotations[route.path]
            };

            // Map the route to all of its `names`.
            pathAnnotations.names.forEach(function (name) {
                map[name] = entry;
            });
        });

        return map;
    }, {});
}

function getRouteParams(routeMap) {
    /* jshint validthis:true, expr:true */
    var params    = this.params,
        paramsMap = {};

    if (!params || !Object.keys(params).length) {
        return paramsMap;
    }

    routeMap || (routeMap = this.getRouteMap());

    // Creates a param -> handler map for the params used in the specified
    // `routeMap` which have handlers.
    return Object.keys(routeMap).reduce(function (map, routeName) {
        var route = routeMap[routeName];

        route.keys.forEach(function (p) {
            var paramName = p.name,
                param     = params[paramName];

            if (param) {
                map[paramName] = param;
            }
        });

        return map;
    }, paramsMap);
}

function registerParam(name, handler) {
    /*jshint validthis:true */

    // This unobtrusive params bookkeeper stores a reference to any param
    // handlers that are regular express or basic, non-middleware functions. It
    // is assumed that the Express Params package is the next param registration
    // function to be called.
    if ((handler instanceof RegExp) || handler.length < 3) {
        this.params[name] = handler;
    }
    return function (req, res, next, value) {
        next();
    };
}
