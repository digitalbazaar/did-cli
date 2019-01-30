/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const didcv1 = require('did-client-veres-one');
const keyStorage = require('../../storage');
const helpers = require('./helpers');
const jsonld = require('jsonld');
const logger = require('./logger');
const _send = require('./send');
const util = require('../../util');

module.exports = async options => {
  logger._debug(options, 'authn-add', {did: options.did});
  const did = options.did;
  // lock local
  const release = await helpers._lockDid(did, options);
  // get local did doc
  const privateDidDocument = await keyStorage.load(did);
  // get remote did doc
  const hostname = helpers._getHostname(options);
  const didDocument = await didcv1.getObservable(
    {did, hostname, env: options.mode});

  // FIXME: move most of this to ext library
  const suiteId = helpers._suiteIdMap[options.suite];
  // get next key not in local or ledger docs
  let nextKeyId;
  do {
    nextKeyId = helpers._nextKeyId(privateDidDocument, suiteId);
  } while(helpers._hasKeyId(didDocument, nextKeyId));
  const params = helpers._getParamsForType(
    privateDidDocument, suiteId, options.type);
  const ledgerParams = helpers._getParamsForType(
    didDocument, suiteId, options.type);

  // public ledger key
  const newLedgerKey = {
    id: nextKeyId,
    owner: privateDidDocument.id
  };
  if(options.type === 'ed25519') {
    newLedgerKey.type = 'Ed25519VerificationKey2018';
    if(options.public) {
      newLedgerKey.publicKeyBase58 = options.public;
    }
  } else if(options.type === 'rsa') {
    throw new Error('not implemented');
  }
  // clone and add to private local key
  const newLocalKey = util.deepClone(newLedgerKey);
  if(options.type === 'ed25519') {
    if(options.private) {
      newLocalKey.privateKey = {
        privateKeyBase58: options.private
      };
    }
  } else if(options.type === 'rsa') {
    throw new Error('not implemented');
  }
  // add to local and remote docs
  jsonld.addValue(params, 'publicKey', newLedgerKey);
  jsonld.addValue(ledgerParams, 'publicKey', newLocalKey);

  // FIXME: reusing import code, rename it
  helpers._import(options, privateDidDocument);

  await release();

  logger._log(options, 'DID local update successful.');

  // if(options.send) {
  await _send(
    {options, didDocument, privateDidDocument, operationType: 'update'});
  // }
};
