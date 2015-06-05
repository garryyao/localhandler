#!/usr/bin/env node
require('shelljs/global');
var SILENT = {silent: 1};
if (exec('which bower', SILENT).code) {
	console.error('This npm package requires Bower, you can fix that by: (sudo) npm i -g bower ');
}

exit(exec('./node_modules/.bin/bower  install' + ' --allow-root -q -F --config.cwd="' + __dirname + '"').code);