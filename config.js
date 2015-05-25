/*
* RequireJS configuration for running TroopJS in node
*/
var path = require('path');
var require = require('requirejs');
require.config({
  waitSeconds: 0,
  baseUrl: path.join(__dirname, 'bower_components'),
  packages: [
    {
      name: 'when',
      main: 'when.js'
    },
    {
      name: 'mu-merge',
    },
    {
      name: 'mu-unique',
    },
    {
      name: 'mu-getargs',
    }
  ],
  map: {
    '*': {
      'troopjs-core/net/uri': 'troopjs-contrib-browser/net/uri',
      'troopjs-core/logger/pubsub': 'troopjs-log/logger'
    }
  },
  config: {
    'troopjs-data/query/service': {
      protocol: 'http',
      // sub-domain could be added in during runtime
      host: 'englishtown.com',
      pathname: '/services/shared/queryproxy'
    }
  }
});
module.exports = require;
