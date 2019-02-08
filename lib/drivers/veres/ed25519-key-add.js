/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const helpers = require('./helpers');
const logger = require('./logger');
const _send = require('./send');
const {LDKeyPair} = require('crypto-ld');

module.exports = async options => {
  const {
    did, private: privateKeyBase58, public: publicKeyBase58,
    purpose: proofPurpose
  } = options;
  logger._debug(options, 'ed25519-key-add', {did});
  const privateDidDocument = await helpers.getSynchronizedDid(options);
  // create the key
  // TODO: implement passphrase
  const keyPair = await LDKeyPair.from({
    controller: did, privateKeyBase58, publicKeyBase58,
    type: 'Ed25519VerificationKey2018'
  });

  keyPair.id = privateDidDocument.generateKeyId({did, keyPair});
  if(keyPair.id in privateDidDocument.keys) {
    throw new Error('The key already exists.');
  }

  // activate a JSON patch observer which will be resolved in _send.
  privateDidDocument.observe();
  privateDidDocument.addKey({key: keyPair, proofPurpose});

  logger._log(options, 'DID local update successful.');

  await _send(
    {options, didDocument: privateDidDocument, operationType: 'update'});
};
