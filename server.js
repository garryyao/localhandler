#!/usr/bin/env node
var express = require('express');
require('when/monitor/console');
var cli = require('commander');
var pkg = require('./package.json');
var when = require('when');
var nodefn = require('when/node');
var sequence = require('when/sequence');
var replace = nodefn.lift(require('async-replace'));
var request = nodefn.liftAll(require('request').defaults({jar: true}));
var walk = require('walk').walk;
var path = require('path');
var url = require('url');
var _ = require('lodash');
var parseDomain = require("parse-domain");
require('colors').setTheme({prompt: 'grey', ok: 'green', warn: 'yellow', fail: 'red'});

// promisfy all of the fs methods
var fs = nodefn.liftAll(require('fs'), function(promisedFs, liftedFunc, name) {
  if (!/Sync/.test(name)) {
    promisedFs[name] = liftedFunc;
  }
  return promisedFs;
});

/*
 // To debug troop queries.
 require('request-debug')(require('request'), function(type, data, req) {
   if (type === 'request') {
     console.log(req.path, data);
   }
 });

*/
cli.version(pkg.version)
  .description(pkg.description)
  .option(
  '-c, --umbraco [cms]',
  'the Umbraco local directory where the CMS query is resolved by each content key as a file, default to the current directory'
)
  .option(
  '-p, --port [port]',
  'a custom port that the HTTP server will listen on'
)
  .option(
  '-b, --basepath [basepath]',
  'Base path of the application where URLs resolves to the working directory, default to the current directory'
)
  .option(
  '-f, --processor [processor]',
  'specify a module that exports a custom html processor function'
)
  .parse(process.argv);

var processor = cli.processor ? require(cli.processor) : null;

var require = require('./config');
var hub = require('troopjs-core/pubsub/hub');
function query(the_query) {
  return hub.publish('query', the_query);
}

/**
 * @type Enum enumeration of dev server environments
 * @oneOf "uat", "qa", "staging"
  */
var env;
var app = express();
var router = express.Router();

/* LIST OF SUPPORTED MACROS */
var CCL_REGEX = /getCCL::([^'\"</\s]*)|\{CCL:(.+?)\}/gi;
var BLURB_REGEX = /getTrans::([\d]*)/gi;
var MEDIA_REGEXP = /getMedia::([\d]*)/gi;
var CMS_REGEX = /getContent::([^'\"</\s]*)/gi;

// possible subdomain name maps to Englishtown env server.
var DOMAIN_MAP = {
  'uat': 'uat',
  'qa': 'qa',
  'cn': 'www',
  'us': 'www',
  'www': 'www',
  'live': 'www'
};

function determinateDomain(domain) {
  return (env = DOMAIN_MAP[domain.subdomain] || 'qa');
}

// bootstrap TroopJS services
var bootstrapTroop = _.once(function startTroopApplication(domain) {
  var done = working('Establishing queryproxy for '+ determinateDomain(domain).warn + ' env...');
  var df = when.defer();
  require([
    'troopjs-data/query/service', // Troop query as a service.
    'troopjs-data/cache/component', // Troop data cache component.
    'troopjs-ef/service/registry',  // registry service
    'troopjs-ef/service/config'  // eTown query configuration.
  ], function Bootstrap(QueryService,
    Cache,
    Registry,
    ConfigService) {
    var cache = Cache();
    sequence([AjaxService(),
      QueryService(cache),
      Registry(),
      ConfigService(cache)
    ].map(function(service) {
        return service.start.bind(service);
      })).then(df.resolve).catch(df.reject);
  });
  return df.promise.tap(done);
});

function liftLast(args) {
  return nodefn.liftCallback(args[args.length - 1]);
}

function getDomain(str) {
  // handle unrecognized domain name like .dev or .local:
  if (parseDomain(str) === null) {
    str += '.com';
  }
  var retval = parseDomain(str);
  retval.toString = function() {
    return [retval.subdomain, retval.domain, retval.tld].join('.');
  };
  return retval;
}

var Service = require('troopjs-core/component/service');
/**
 *  A Troop query transport of request/request.
 */
var AjaxService = Service.extend({
  "displayName": "net/ajax/service",

  'sig/start': function() {
  },
  /**
   * The ajax event
   * @event hub/ajax
   * @param {Object} settings Ajax settings
   */

  /**
   * Make ajax request.
   * @handler
   * @inheritdoc #event-hub/ajax
   */
  "hub/ajax": function ajax(settings) {
    var d = getDomain(settings.host);
    d.subdomain = env;
    settings.host = d.toString();
    var queryproxy = url.format(settings);
    return request.post(queryproxy, {
      headers: { "x-troopjs-request-id": new Date().getTime()},
      form: settings.data
    }).spread(function(response, body) {
      return JSON.parse(body);
    }).catch(function(er) {
    });
  }
});

function working(msg) {
  process.stdout.write(msg);
  return function jobDone() {
    console.log('[done]'.ok);
  }
}


var CMS_DIR = cli.umbraco;

var indexCMSFiles = _.once(function buildCMSFileIndex() {
  var map = {};
  if(!CMS_DIR)
    return map;

  var df = when.defer();
  // go through the list of local git CMS files for publishing.
  walk(CMS_DIR, {followLinks: false}).on('file',
    function(dir, file, next) {
      var key = path.basename(file.name, path.extname(file.name)).toLowerCase();
      map[key] = path.join(CMS_DIR, file.name);
      next();
    }).on('end', function() {
      df.resolve(map);
    }).on('errors', df.reject);
  return df.promise;
});

when.all([
  indexCMSFiles()
]).spread(function(cmsMap) {

  function render(path, options) {
    return fs.readFile(path, 'utf8').then(function (val) {
      return processor? processor(val) : val;
    }).then(function(content) {
      return replace(content, CMS_REGEX, function(match, cmsKey) {
        var done = liftLast(arguments);
        var cms_file = cmsMap[cmsKey.toLowerCase()];
        if (cms_file) {
          done(render(cms_file, options));
        } else {
          done(query('cms!' + cmsKey).spread(function (res) {
            return res.content;
          }));
        }
      });
    }).then(function(content) {
      return replace(content, CCL_REGEX, function(match, g1, g2) {
        var done = liftLast(arguments);
        var ccl = g1 || g2;
        // escape CCL key which contains dot
        done(query('ccl!"' + ccl + '"').spread(function(res) {
          return res.value;
        }));
      });
    }).then(function(content) {
      return replace(content, BLURB_REGEX, function(match, blurbId) {
        var done = liftLast(arguments);
        done(query('blurb!' + blurbId).spread(function(res) {
          return res.translation;
        }));
      });
    }).then(function(content) {
      return replace(content, MEDIA_REGEXP, function(match, mediaId) {
        var done = liftLast(arguments);
        done(query('media!' + mediaId).spread(function(res) {
          // drop off the origin, to align with handler syntax.
          return url.parse(res.url).path;
        }));
      });
    });
  }

  // mount the base path
  app.use('/' + (cli.basepath || ''), router);

  // handlers comes first.
  router.get('/*.html', function (req, res) {

    // leave alone the mock-up htmls.
    //var origin = req.protocol + '://' + req.hostname;
    var page = req.params[0] + path.extname(req.path);

    // domain determination
    var hds = req.headers;
    // in case this request comes from a proxy
    var host = hds['x-forwarded-host'] || hds['x-forwarded-server'] || hds.host;
    bootstrapTroop(getDomain(host)).then(function () {
      res.render(page);
    });
  });

  app.set('views', './');

  // change HTML template engine to Englishtown macros handler.
  app.engine('html', function(filePath, options, callback) {
    var handleRender = nodefn.liftCallback(callback);
    return handleRender(render(filePath, options));
  });

  app.set('trust proxy', true);   // express running behind a proxy
  app.set('view engine', 'html'); // register the template engine

  var server = app.listen(cli.port || 3000, function() {
    var localhost = require('os').hostname();
    var port = server.address().port;
    console.log('localhandler is running on port:%s', port);
    console.log("If you're currently running through Apache mod_proxy, simply add this rule to your <VirtualHost>, to add it as a reverse proxy:".prompt);
    console.log('ProxyPassMatch ^/(.*\.html)$ http://%s:%s/$1'.warn, localhost, port);
  });
});

