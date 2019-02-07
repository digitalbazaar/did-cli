/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const helpers = require('./helpers');
const logger = require('./logger');
const _send = require('./send');
const {LDKeyPair} = require('crypto-ld');
const {VeresOne} = require('did-veres-one');

module.exports = async options => {
  // TODO: pass in hostname etc.
  const hostname = helpers._getHostname(options);
  const v1 = new VeresOne({hostname, mode: options.mode});
  const {
    did, private: privateKeyBase58, public: publicKeyBase58,
    purpose: proofPurpose
  } = options;
  logger._debug(options, 'ed25519-key-add', {did});
  // lock local
  // const release = await helpers._lockDid(did, options);
  // get local did doc
  const privateDidDocument = await v1.getLocal({did});
  // get remote did doc
  const remoteDidDocument = await v1.getRemote({did});

  // TODO: implement a more robust check?
  // ensure that local and remote documents are in sync
  if(privateDidDocument.meta.sequence !== remoteDidDocument.meta.sequence) {
    // FIXME: provide some useful recourse
    throw new Error('Local and remote documents are out of sync.');
  }
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
  privateDidDocument.observe();
  privateDidDocument.addKey({key: keyPair, proofPurpose});

  logger._log(options, 'DID local update successful.');

  // if(options.send) {
  await _send(
    {options, didDocument: privateDidDocument, operationType: 'update', v1});
  // }
};
