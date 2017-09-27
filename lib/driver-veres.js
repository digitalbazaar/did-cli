/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const bedrock = require('bedrock');
const equihashSigs = require('equihash-signature');
const forge = require('node-forge');
const jsonld = bedrock.jsonld;
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
  const did = 'did:v1:testnet:' + (options.did || uuid());

  console.log('Creating new DID on Veres One...');
  console.log(`  DID: ${did}`);

  async.auto({
    generateKeyPair: callback =>
      rsa.generateKeyPair({bits: 2048, workers: -1}, callback),
    pow: ['generateKeyPair', (results, callback) => {
      const publicKeyPem =
        pki.publicKeyToPem(results.generateKeyPair.publicKey);
      const fingerprint = pki.getPublicKeyFingerprint(
        results.generateKeyPair.publicKey, {
        type: 'SubjectPublicKeyInfo',
        encoding: 'hex',
        delimiter: ':'
      });

      // print public key for DID
      console.log(`  Public Key: ${fingerprint}`);

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

      equihashSigs.sign({
          doc: ledgerEvent,
          n: 128,
          k: 7
        }, callback);
    }],
    sign: ['pow', (results, callback) => {
      const privateKeyPem =
        pki.privateKeyToPem(results.generateKeyPair.privateKey);

      // sign the DID Document
      jsigs.sign(results.pow, {
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
    postDidDocument: ['sign', (results, callback) => {
      const registerUrl = {
        protocol: 'https',
        host: 'veres.one.local:42443',
        pathname: '/dids/' + results.sign.input[0].id
      };
      request.post({
        url: url.format(registerUrl),
        body: results.sign,
      }, callback);
    }]
  }, (err, results) => {
    if(err) {
      return console.error(
        'Failed to register DID Document', JSON.stringify(err, null, 2));
    }

    if(results.postDidDocument.statusCode === 202) {
      const didDocument = JSON.stringify(results.signDocument, null, 2);
      console.log(`  DID Document: \n${didDocument}`);
    } else {
      console.error(
        'Failed to register DID Document', JSON.stringify(results.postDidDocument, null, 2));
    }
  });
};
