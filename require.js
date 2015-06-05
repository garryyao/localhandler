/*
* RequireJS configuration for running TroopJS in node
*/
var path = require('path');
var require = require('requirejs');
require.config({
  waitSeconds: 0,
  baseUrl: path.join(__dirname, 'node_modules')
});
module.exports = require;
