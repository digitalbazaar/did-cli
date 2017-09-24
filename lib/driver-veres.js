/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const uuid = require('uuid').v4;

const api = {};
module.exports = api;

api.create = options => {
  const did = 'did:v1:testnet:' + (options.did || uuid());

  console.log('Creating new DID on Veres One...');
  console.log(`   DID: ${did}`);
};
