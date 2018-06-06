/* jshint ignore:start */
importScripts('/bower_components/requirejs/require.js');
require.config({
        // fix up locations so that relative urls work.
        baseUrl: '/',
        paths: { 
            // jquery declares itself as literally "jquery" so it cannot be pulled by path :(
            "jquery": "/bower_components/jquery/dist/jquery.min",
            // json.sortify same
            "json.sortify": "/bower_components/json.sortify/dist/JSON.sortify",
            cm: '/bower_components/codemirror'
        },
        map: {
            '*': {
                'css': '/bower_components/require-css/css.js',
                'less': '/common/RequireLess.js',
            }
        }
});

window = self;
localStorage = {
    setItem: function (k, v) { localStorage[k] = v; },
    getItem: function (k) { return localStorage[k]; }
};
require([
    '/common/common-util.js',
    '/common/outer/worker-channel.js',
    '/common/outer/store-rpc.js'
], function (Util, Channel, Rpc) {
    var msgEv = Util.mkEvent();

    Channel.create(msgEv, postMessage, function (chan) {
        console.log('ww ready');
        var clientId = '1';
        Object.keys(Rpc.queries).forEach(function (q) {
            if (q === 'CONNECT') { return; }
            if (q === 'JOIN_PAD') { return; }
            if (q === 'SEND_PAD_MSG') { return; }
            chan.on(q, function (data, cb) {
                try {
                    Rpc.queries[q](clientId, data, cb);
                } catch (e) {
                    console.error('Error in webworker when executing query ' + q);
                    console.error(e);
                    console.log(data);
                }
            });
        });
        chan.on('CONNECT', function (cfg, cb) {
            console.log('onConnect');
            // load Store here, with cfg, and pass a "query" (chan.query)
            // cId is a clientId used in ServiceWorker or SharedWorker
            cfg.query = function (cId, cmd, data, cb) {
                cb = cb || function () {};
                chan.query(cmd, data, function (err, data2) {
                    if (err) { return void cb({error: err}); }
                    cb(data2);
                });
            };
            cfg.broadcast = function (excludes, cmd, data, cb) {
                cb = cb || function () {};
                if (excludes.indexOf(clientId) !== -1) { return; }
                chan.query(cmd, data, function (err, data2) {
                    if (err) { return void cb({error: err}); }
                    cb(data2);
                });
            };
            Rpc.queries['CONNECT'](clientId, cfg, function (data) {
                console.log(data);
                if (data && data.state === "ALREADY_INIT") {
                    return void cb(data);
                }
                if (cfg.driveEvents) {
                    Rpc._subscribeToDrive(clientId);
                }
                if (cfg.messenger) {
                    Rpc._subscribeToMessenger(clientId);
                }
                cb(data);
            });
        });
        var chanId;
        chan.on('JOIN_PAD', function (data, cb) {
            chanId = data.channel;
            try {
                Rpc.queries['JOIN_PAD'](clientId, data, cb);
            } catch (e) {
                console.error('Error in webworker when executing query JOIN_PAD');
                console.error(e);
                console.log(data);
            }
        });
        chan.on('SEND_PAD_MSG', function (msg, cb) {
            var data = {
                msg: msg,
                channel: chanId
            };
            try {
                Rpc.queries['SEND_PAD_MSG'](clientId, data, cb);
            } catch (e) {
                console.error('Error in webworker when executing query SEND_PAD_MSG');
                console.error(e);
                console.log(data);
            }
        });
    }, true);

    onmessage = function (e) {
        msgEv.fire(e);
    };
});
