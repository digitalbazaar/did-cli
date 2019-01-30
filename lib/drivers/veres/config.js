/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const keyStorage = require('../../storage');
const logger = require('./logger');

const api = {};
module.exports = api;

api._lockConfig = async (options) => {
  logger._debug(options, 'config: locking');
  return keyStorage.lockConfig(options);
};

api._storeConfig = async (config, options) => {
  logger._debug(options, 'config: storing');
  return keyStorage.storeConfig(config, options);
};

api._loadConfig = async (options) => {
  logger._debug(options, 'config: loading');
  const config = await keyStorage.loadConfig(options);
  if(config) {
    if(config['urn:did-client:config:version'] !== '1') {
      throw new Error('Unknown config file version');
    }
    return config;
  }
  // default
  return keyStorage.defaults.config();
};
