/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const bedrock = require('bedrock');
const equihashSigs = require('equihash-signature');
const forge = require('node-forge');
const jsigs = require('jsonld-signatures');
const pki = forge.pki;
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
const rsa = forge.pki.rsa;
const url = require('url');
const uuid = require('uuid').v4;

jsigs.use('jsonld', bedrock.jsonld);

const api = {};
module.exports = api;

api.create = options => {
  let did = 'did:v1:testnet:' + (options.did || uuid());
  let hostname = 'testnet.veres.one';

  if(options.mode === 'dev') {
    hostname = 'veres.one.local:42443';
  } else if(options.mode === 'production') {
    did = 'did:v1:' + (options.did || uuid());
    hostname = 'veres.one';
  }

  console.log('Creating new DID on Veres One...');
  console.log(`  DID: ${did}`);

  async.auto({
    generateKeyPair: callback => {
      console.log('  Generating RSA keypair...');
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
      console.log(`    public Key: ${fingerprint}`);

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
      console.log('  Generating Equihash proof of work...');
      equihashSigs.sign({
        doc: results.ledgerEvent,
        n: 64,
        k: 3
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
