/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const equihashSigs = require('equihash-signature');
const forge = require('node-forge');
const jsigs = require('jsonld-signatures');
const jsonld = require('jsonld');
const pki = forge.pki;
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
const rsa = forge.pki.rsa;
const url = require('url');
const uuid = require('uuid').v4;

// setup JSON-LD library to use
jsigs.use('jsonld', jsonld);
equihashSigs.use('jsonld', jsonld);

const api = {};
module.exports = api;

api.create = options => {
  let did = 'did:v1:testnet:' + (options.did || uuid());
  let hostname = 'testnet.veres.one';

  if(options.mode === 'dev') {
    hostname = 'veres.one.local:42443';
  } else if(options.mode === 'live') {
    did = 'did:v1:' + (options.did || uuid());
    hostname = 'veres.one';
  }

  console.log(`Creating new DID on Veres One [${options.mode}]...`);
  console.log(`  DID: ${did}`);

  async.auto({
    generateKeyPair: callback => {
      console.log('  Generating RSA keypair... (5-15 seconds)');
      rsa.generateKeyPair({bits: 2048, workers: -1}, callback);
    },
    ledgerEvent: ['generateKeyPair', (results, callback) => {
      const publicKeyPem =
        pki.publicKeyToPem(results.generateKeyPair.publicKey);
      const fingerprint = pki.getPublicKeyFingerprint(
        results.generateKeyPair.publicKey, {
          type: 'SubjectPublicKeyInfo',
          encoding: 'hex',
          delimiter: ':'
        });

      // print public key for DID
      console.log(`    Public Key: ${fingerprint}`);

      // construct DID document
      const didDocument = {
        '@context': 'https://w3id.org/veres-one/v1',
        id: did,
        authorizationCapability: [{
          permission: 'UpdateDidDocument',
          entity: did,
          permittedProofType: [{
            proofType: 'LinkedDataSignature2015'
          }, {
            proofType: 'EquihashProof2017',
            equihashParameterAlgorithm: 'VeresOne2017'
          }]
        }],
        authenticationCredential: [{
          id: did + '/keys/1',
          type: 'CryptographicKey',
          owner: did,
          publicKeyPem: publicKeyPem
        }]
      };

      // construct the Web Ledger event
      const ledgerEvent = {
        '@context': 'https://w3id.org/webledger/v1',
        type: 'WebLedgerEvent',
        operation: 'Create',
        input: [didDocument]
      };
      callback(null, ledgerEvent);
    }],
    pow: ['ledgerEvent', (results, callback) => {
      let nParam = 144;
      let kParam = 5;
      if(options.mode === 'dev') {
        nParam = 64;
        kParam = 3;
      } else if(options.mode === 'testnet') {
        nParam = 128;
        kParam = 7;
      }
      console.log('  Generating Equihash proof of work... (60-120 seconds)');
      equihashSigs.sign({
        doc: results.ledgerEvent,
        n: nParam,
        k: kParam
      }, callback);
    }],
    sign: ['ledgerEvent', (results, callback) => {
      const privateKeyPem =
        pki.privateKeyToPem(results.generateKeyPair.privateKey);

      // sign the DID Document
      jsigs.sign(results.ledgerEvent, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem: privateKeyPem,
        creator: did + '/keys/1'
      }, (err, result) => {
        if(err) {
          return callback(err);
        }
        callback(null, result);
      });
    }],
    postDidDocument: ['pow', 'sign', (results, callback) => {
      const postEvent = results.ledgerEvent;
      postEvent.signature = [
        results.pow.signature,
        results.sign.signature
      ];
      const registerUrl = {
        protocol: 'https',
        host: hostname,
        pathname: '/dids/' + results.ledgerEvent.input[0].id
      };
      request.post({
        url: url.format(registerUrl),
        body: postEvent
      }, (err, res) => callback(err, res));
    }]
  }, (err, results) => {
    if(err) {
      return console.error(
        'Failed to register DID Document', JSON.stringify(err, null, 2));
    }

    if(results.postDidDocument.statusCode === 202) {
      console.log('DID creation successful:\n',
        JSON.stringify(results.ledgerEvent.input[0], null, 2));
    } else {
      console.error(
        'Failed to register DID Document',
        JSON.stringify(results.postDidDocument.body, null, 2));
    }
  });
};

api.get = options => {
  const did = options.args[1];
  let hostname = 'testnet.veres.one';

  if(options.mode === 'dev') {
    hostname = 'veres.one.local:42443';
  } else if(options.mode === 'live') {
    hostname = 'veres.one';
  }

  console.log(`Retrieving DID Document from Veres One [${options.mode}]...`);

  async.auto({
    get: callback => {
      const getUrl = {
        protocol: 'https',
        host: hostname,
        headers: [{
          name: 'accept',
          value: 'application/ld+json'
        }],
        pathname: '/dids/' + did
      };
      request.get({
        url: url.format(getUrl)
      }, (err, res) => callback(err, res));
    }
  }, (err, results) => {
    if(err) {
      return console.error(
        'Failed to get DID Document', JSON.stringify(err, null, 2));
    }

    if(results.get.statusCode === 200) {
      console.log(JSON.stringify(results.get.body, null, 2));
    } else {
      console.error(
        'Failed to get DID Document',
        JSON.stringify(results.get, null, 2));
    }
  });
};
