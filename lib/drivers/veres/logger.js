/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const chalk = require('chalk');

const api = {};
module.exports = api;

api.__log = (options, f, msg, ...rest) => {
  f(
    `[${chalk.bold('Veres One')}][${chalk.bold(options.mode)} mode] ${msg}`,
    ...rest);
};

api._log = (options, ...rest) => {
  if(!options.quiet) {
    api.__log(options, console.log, ...rest);
  }
};

api._error = (options, ...rest) => {
  api.__log(options, console.error, chalk.bold.red('ERROR'), ...rest);
};

api._debug = (options, ...rest) => {
  if(options.verbose >= 2) {
    api._log(options, ...rest);
  }
};

api._verbose = (options, ...rest) => {
  if(options.verbose >= 1) {
    api._log(options, ...rest);
  }
};
