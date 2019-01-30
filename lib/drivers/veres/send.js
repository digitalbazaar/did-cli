/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _config = require('./config');
const didv1 = require('did-veres-one');
const didcv1 = require('did-client-veres-one');
const keyStorage = require('../../storage');
const helpers = require('./helpers');
const jsonld = require('jsonld');
const logger = require('./logger');

module.exports = async ({
  options, didDocument, privateDidDocument, operationType = 'create', v1
}) => {
  const hostname = helpers._getHostname(options);

  if(operationType === 'create') {
    logger._log(options, 'Preparing to register a DID on Veres One...');
  } else {
    logger._log(options, 'Preparing to update a DID Document on Veres One...');
  }
  try {
    await v1.register({didDocument});
    logger._log(options, 'DID registration sent to ledger.');
  } catch(e) {
    console.log('An error occurred:', e.message);
  }
  logger._log(options, 'Please wait ~15-30 seconds for ledger consensus.');
  logger._log(options, 'You may use the `info` command to monitor the ' +
    'registration of your DID.');
  return;

  // wrap DID Document in a web ledger operation
  let operation = didv1.wrap({didDocument, operationType});

  if(options.accelerator) {
    // use accelerator
    logger._log(options, 'Using accelerator...');
    if(!options.auth) {
      throw new Error('Authorizaion DID required');
    }
    const authDid = await keyStorage.load(options.auth);

    // send DID Document to a Veres One accelerator
    logger._log(options, 'Generating accelerator signature...');
    const _opts = {
      operation,
      hostname: options.accelerator,
      env: options.mode,
      keyId: authDid.authentication[0].publicKey[0].id
    };
    if(authDid.authentication[0].publicKey[0].privateKey.privateKeyPem) {
      _opts.key =
        authDid.authentication[0].publicKey[0].privateKey.privateKeyPem;
    } else {
      // _opts.key =
      //   authDid.authentication[0].publicKey[0].privateKey.privateKeyBase58;
      throw new Error(
        'Unsupported authentication DID. Only RSA keys supported.');
    }
    const response = await didcv1.sendToAccelerator(_opts);
    // FIXME: verify wrapped operation
    operation = await response.json();
  } else {
    // attach an equihash proof
    logger._log(
      options, 'Generating Equihash proof of work... (60-120 seconds)');
    operation = await didv1.attachEquihashProof({operation});
  }

  // get public key ID
  const creator = didDocument.invokeCapability[0].publicKey[0].id;

  // get private key
  const privateKey = privateDidDocument.invokeCapability[0].publicKey[0]
    .privateKey;

  if(!privateKey) {
    throw new Error('Private key required to perform a send');
  }

  // attach capability invocation proof
  logger._log(options, 'Attaching LD-OCAP invocation proof...');
  operation = await didv1.attachInvocationProof({
    operation,
    capability: didDocument.id,
    capabilityAction: operationType === 'create' ?
      'RegisterDid' : 'UpdateDidDocument',
    creator,
    privateKeyPem: privateKey.privateKeyPem,
    privateKeyBase58: privateKey.privateKeyBase58,
  });

  // send DID Document to a Veres One ledger node
  if(operationType === 'create') {
    logger._log(options, 'Registering DID on Veres One...');
  } else {
    logger._log(options, 'Updating DID Document on Veres One...');
  }
  const response = await didcv1.send({
    operation,
    hostname,
    env: options.mode
  });

  if(response.status === 204) {
    if(operationType === 'create') {
      logger._log(options, 'DID registration sent to ledger.');
    } else {
      logger._log(options, 'DID Document update sent to the Veres One ledger.');
    }
    logger._log(options, 'Please wait ~15-30 seconds for ledger consensus.');
    logger._log(options, 'You may use the `info` command to monitor the ' +
      'registration of your DID.');

    if(options.notes) {
      // save ledger if requested
      const release = await _config._lockConfig(options);
      const config = await _config._loadConfig(options);
      const notes = {};
      if(jsonld.hasValue(config, 'urn:did-client:notes:auto', 'ledger')) {
        jsonld.addValue(notes, 'ledger', `${options.ledger}:${options.mode}`);
      }
      await release();
      await helpers._notesAddMany(didDocument.id, notes, options);
    }
  } else {
    logger._error(options, 'Failed to register DID Document.');
    logger._error(options, 'Status Code: ' + response.status);
    logger._error(options, 'Response Body: ' +
      JSON.stringify(await response.json(), null, 2));
  }
};
