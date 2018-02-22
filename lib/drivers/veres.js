/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const didv1 = require('did-veres-one');
const didcv1 = require('did-client-veres-one');
const keyStorage = require('../storage');
const r2 = require('r2');

// configure libraries
const jsonld = require('jsonld')();
const documentLoader = jsonld.documentLoader;
jsonld.documentLoader = async url => {
  if(url in didv1.contexts) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: didv1.contexts[url]
    };
  }
  return documentLoader(url);
};
const jsigs = require('jsonld-signatures');
jsigs.use('jsonld', jsonld);
const eproofs = require('equihash-signature');
eproofs.install(jsigs);
didv1.use('jsonld', jsonld);
didv1.use('jsonld-signatures', jsigs);

const api = {};
module.exports = api;

api.create = async options => {
  let hostname;

  if(options.mode === 'dev') {
    hostname = 'genesis.veres.one.localhost:42443';
  } else if(options.mode === 'test') {
    hostname = 'genesis.testnet.veres.one';
  } else if(options.mode === 'live') {
    hostname = 'veres.one';
  } else {
    throw new Error('Unknown mode');
  }

  // override mode
  if(options.hostname) {
    hostname = options.hostname;
  }

  console.log(`Creating new DID on Veres One [${options.mode}]...`);

  console.log('  Generating keypair... (5-15 seconds)');

  // generate a DID Document
  const {publicDidDocument: didDocument, privateDidDocument} =
    await didv1.generate(
      {keyType: 'Ed25519VerificationKey2018', passphrase: null});

  console.log(`  DID: ${didDocument.id}`);

  // get public key ID and private key pem
  const creator = didDocument.invokeCapability[0].publicKey[0].id;

  // FIXME: encrypt private key pair
  // save private DID Document
  console.log('  Storing DID Document on disk...');
  const filename = await keyStorage.store(privateDidDocument);
  console.log('  DID Document stored in:', filename);

  console.log('  Preparing to register DID Document on Veres One...');

  // wrap DID Document in a web ledger operation
  let operation = didv1.wrap({didDocument});

  // get private key
  const privateKey = privateDidDocument.invokeCapability[0].publicKey[0]
    .privateKey;

  // attach an capability invocation proof
  console.log('  Attaching LD-OCAP invocation proof...');
  operation = await didv1.attachInvocationProof({
    operation,
    capability: didDocument.id,
    capabilityAction: 'RegisterDid',
    creator,
    privateKeyPem: privateKey.privateKeyPem,
    privateKeyBase58: privateKey.privateKeyBase58,
  });

  // attach an equihash proof
  console.log('  Generating Equihash proof of work... (60-120 seconds)');
  operation = await didv1.attachEquihashProof({operation});

  // send DID Document to a Veres One ledger node
  console.log('  Registering DID Document on Veres One...');
  const response = await didcv1.send({operation, hostname, env: options.mode});

  if(response.status === 204) {
    console.log('DID registration successful!');
  } else {
    console.error('Failed to register DID Document.');
    console.log('Status Code: ' + response.status);
    console.log('Response Body: ' + JSON.stringify(response.json, null, 2));
  }
};

api.get = async options => {
  const did = options.args[0];

  let hostname = 'genesis.testnet.veres.one';
  if(options.mode === 'dev') {
    hostname = 'genesis.veres.one.localhost:42443';
  } else if(options.mode === 'live') {
    hostname = 'veres.one';
  }

  console.log(`Retrieving DID Document from Veres One [${options.mode}]...`);

  const https = require('https');
  const agent = new https.Agent({rejectUnauthorized: false});
  const didUrl = `https://${hostname}/dids/${did}`;
  const response = await r2({
    url: didUrl,
    method: 'GET',
    agent: (options.mode === 'dev') ? agent : undefined,
    headers: {
      'accept': 'application/ld+json, application/json'
    }
  }).response;

  if(response.status !== 200) {
    console.error('Failed to get DID Document.');
    console.log('Status Code: ' + response.status);
    console.log('Response Body: ' + JSON.stringify(response.json, null, 2));
    return;
  }
  console.log(JSON.stringify(await response.json(), null, 2));
};
