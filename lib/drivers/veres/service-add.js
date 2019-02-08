/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const helpers = require('./helpers');
const logger = require('./logger');
const _send = require('./send');

module.exports = async options => {
  const didDocument = await helpers.getSynchronizedDid(options);
  // activate a JSON patch observer which will be resolved in _send.
  didDocument.observe();
  const {endpoint, fragment, type} = options;
  didDocument.addService({endpoint, fragment, type});

  logger._log('DID local update successful.');

  await _send({options, didDocument, operationType: 'update'});
};
