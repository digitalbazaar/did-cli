/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _config = require('./config');
const keyStorage = require('../../storage');
const jsonld = require('jsonld');
const logger = require('./logger');

const api = {};
module.exports = api;

// get default mode hostname
api._getDefaultHostname = options => {
  if(options.mode === 'dev') {
    return 'genesis.veres.one.localhost:42443';
  } else if(options.mode === 'test') {
    return 'genesis.testnet.veres.one';
  } else if(options.mode === 'live') {
    return 'veres.one';
  } else {
    throw new Error('Unknown mode');
  }
};

// get single hostname, allow single override
api._getHostname = options => {
  const optHostnames = api._getOptionHostnames(options);
  if(optHostnames.length > 1) {
    throw new Error('Too many hostnames provided');
  }
  if(optHostnames.length === 1) {
    return optHostnames[0];
  }
  return api._getDefaultHostname(options);
};

// get option hostnames
api._getOptionHostnames = options => {
  const hostnames = options.hostname || [];
  return Array.isArray(hostnames) ? hostnames : [hostnames];
};

// get or create params
api._getParamsForType = (didDocument, suiteId, type) => {
  for(const suiteParams of jsonld.getValues(didDocument, suiteId)) {
    if(suiteParams.type === api._suiteParamsTypeMap[suiteId][type]) {
      return suiteParams;
    }
  }
  // not found, create
  const params = {
    type: api._suiteParamsTypeMap[suiteId][type],
    publicKey: []
  };
  jsonld.addValue(didDocument, suiteId, params);
  return params;
};

api._hasKeyId = (didDocument, id) => {
  // check all suites
  for(const suiteId of api._suiteIds) {
    for(const suiteParams of jsonld.getValues(didDocument, suiteId)) {
      for(const key of jsonld.getValues(suiteParams, 'publicKey')) {
        if(key.id === id) {
          return true;
        }
      }
    }
  }
  return false;
};

api._import = async (options, privateDidDocument) => {
  // save private DID Document
  logger._log(options, 'Storing DID Document on disk...');
  const filename = await keyStorage.store(privateDidDocument);
  logger._log(options, 'DID Document stored in:', filename);
};

// map suite choice to id prefix
api._keyPrefixMap = {
  'authentication': 'authn-key-',
  'grantCapability': 'grant-key-',
  'invokeCapability': 'invoke-key-'
};

api._lockDid = async (did, options) => {
  logger._debug(options, 'did: locking');
  return keyStorage.lockDid(did, options);
};

// find next unused key id
// TODO: improve algorithm to handle large number of keys
api._nextKeyId = (didDocument, suiteId) => {
  const keyPrefix = api._keyPrefixMap[suiteId];
  let n = 0;
  let nextId;
  do {
    nextId = `${didDocument.id}#${keyPrefix}${++n}`;
  } while(api._hasKeyId(didDocument, nextId));
  return nextId;
};

// used by create, etc.
// pass in object with key/value pairs, all will be set
api._notesAddMany = async (did, properties, options) => {
  if(Object.keys(properties).length === 0) {
    return;
  }

  const release = await _config._lockConfig(options);
  const config = await _config._loadConfig(options);
  for(const property of Object.keys(properties)) {
    const target = config.dids[did] = config.dids[did] || {};
    if(property === 'id' || property === '@id') {
      throw new Error('Can not set "id"');
    }
    jsonld.addValue(
      target, property, properties[property], {allowDuplicate: false});
  }
  await _config._storeConfig(config, options);
  return await release();
};

// all known suites
api._suiteIds = [
  'authentication',
  'grantCapability',
  'invokeCapability'
];

// map suite choice to full suite name
api._suiteIdMap = {
  'authn': 'authentication',
  'authentication': 'authentication',
  'grant': 'grantCapability',
  'grantCapability': 'grantCapability',
  'invoke': 'invokeCapability',
  'invokeCapability': 'invokeCapability'
};

api._suiteParamsTypeMap = {
  authentication: {
    ed25519: 'Ed25519SignatureAuthentication2018',
    rsa: '...'
  },
  grantCapability: {
    ed25519: 'Ed25519SignatureCapabilityAuthorization2018',
    rsa: '...'
  },
  invokeCapability: {
    ed25519: 'Ed25519SignatureCapabilityAuthorization2018',
    rsa: '...'
  }
};
