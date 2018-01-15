/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const async = require('async');
const equihashSigs = require('equihash-signature');
const forge = require('node-forge');
const jsigs = require('jsonld-signatures');
const keyStorage = require('./storage');
const pki = forge.pki;
let request = require('request');
request = request.defaults({json: true, strictSSL: true});
const rsa = forge.pki.rsa;
const url = require('url');
const uuid = require('uuid/v4');

// setup JSON-LD library to use
const jsonld = require('jsonld')();
// Use the local Veres One context...
const _orig_doc_loader = jsonld.documentLoader;
jsonld.documentLoader = function(url, callback) {
    if (url == 'https://w3id.org/veres-one/v1') {
        return callback(null,
                        {contextUrl: null,
                         documentUrl: url,
                         document: v1_context});
    } else {
        return _orig_doc_loader(url, callback);
    }
};
jsigs.use('jsonld', jsonld);
equihashSigs.use('jsonld', jsonld);

const api = {};
module.exports = api;

const v1_context = {
    "@context": {
        "@version": 1.1,
        "id": "@id",
        "type": "@type",

        "dc": "http://purl.org/dc/terms/",
        "identity": "https://w3id.org/identity#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "schema": "http://schema.org/",
        "sec": "https://w3id.org/security#",
        "wl": "https://w3id.org/webledger#",
        "didv": "https://w3id.org/did#",
        "xsd": "http://www.w3.org/2001/XMLSchema#",

        "Config": "wl:Config",
        "Continuity2017": "wl:Continuity2017",
        "Continuity2017Peer": "wl:Continuity2017Peer",
        "Create": "wl:Create",
        "CryptographicKey": "sec:Key",
        "EquihashProof2017": "sec:EquihashProof2017",
        "EventTypeFilter": "wl:EventTypeFilter",
        "GraphSignature2012": "sec:GraphSignature2012",
        "Identity": "identity:Identity",
        "IssueCredential": "didv:IssueCredential",
        "LinkedDataSignature2015": "sec:LinkedDataSignature2015",
        "LinkedDataSignature2016": "sec:LinkedDataSignature2016",
        "MultiproofValidator2017": "wl:ProofOfSignature2017",
        "ProofOfSignature2017": "wl:ProofOfSignature2017",
        "ProofOfWork2016": "wl:ProofOfWork2016",
        "RsaCryptographicKey": "sec:RsaCryptographicKey",
        "RsaSignature2015": "sec:RsaSignature2015",
        "SequentialList": "wl:SequentialList",
        "SignatureValidator2017": "wl:SignatureValidator2017",
        "UnilateralConsensus2017": "wl:UnilateralConsensus2017",
        "UpdateDidDescription": "didv:UpdateDidDescription",
        "WebLedgerConfiguration": "wl:WebLedgerConfiguration",
        "WebLedgerConfigurationEvent": "wl:WebLedgerConfigurationEvent",
        "WebLedgerEvent": "wl:WebLedgerEvent",
        "WebLedgerEventBlock": "wl:WebLedgerEventBlock",

        "approvedSigner": "wl:approvedSigner",
        "authenticationCredential": "sec:authenticationCredential",
        "authorizationCapability": "sec:authorizationCapability",
        "blockHeight": "wl:blockHeight",
        "canonicalizationAlgorithm": "sec:canonicalizationAlgorithm",
        "capability": "sec:capability",
        "comment": "rdfs:comment",
        "consensusMethod": {"@id": "wl:consensusMethod", "@type": "@vocab"},
        "consensusPhase": "wl:consensusPhase",
        "created": {"@id": "dc:created", "@type": "xsd:dateTime"},
        "creator": {"@id": "dc:creator", "@type": "@id"},
        "description": "schema:description",
        "digestAlgorithm": "sec:digestAlgorithm",
        "digestValue": "sec:digestValue",
        "domain": "sec:domain",
        "election": {"@id": "wl:election", "@container": "@set"},
        "electionResult": {"@id": "wl:electionResults", "@container": "@set"},
        "entity": "sec:entity",
        "equihashParameterAlgorithm": "sec:equihashParameterAlgorithm",
        "equihashParameterK": {"@id": "sec:equihashParameterK", "@type": "xsd:integer"},
        "equihashParameterN": {"@id": "sec:equihashParameterN", "@type": "xsd:integer"},
        "event": {"@id": "wl:event", "@container": "@set"},
        "eventFilter": {"@id": "wl:eventFilter", "@type": "@id"},
        "eventHash": "wl:eventHash",
        "eventType": "wl:eventType",
        "eventValidator": {"@id": "wl:eventValidator", "@type": "@id"},
        "expires": {"@id": "sec:expiration", "@type": "xsd:dateTime"},
        "field": {"@id": "didv:field", "@type": "@id"},
        "input": {"@id": "wl:input", "@type": "@id", "@container": ["@graph", "@set"]},
        "label": "rdfs:label",
        "ledger": {"@id": "wl:ledger", "@type": "@id"},
        "ledgerConfiguration": {"@id": "wl:ledgerConfiguration", "@type": "@id"},
        "manifestHash": "wl:manifestHash",
        "minimumProofsRequired": "sec:minimumProofsRequired",
        "minimumSignaturesRequired": "sec:minimumSignaturesRequired",
        "name": "schema:name",
        "nonce": "sec:nonce",
        "normalizationAlgorithm": "sec:normalizationAlgorithm",
        "operation": "wl:operation",
        "owner": {"@id": "sec:owner", "@type": "@id"},
        "permission": "sec:permission",
        "permittedProofType": "sec:permittedProofType",
        "previousBlock": "wl:previousBlock",
        "previousBlockHash": "wl:previousBlockHash",
        "privateKey": {"@id": "sec:privateKey", "@type": "@id"},
        "privateKeyPem": "sec:privateKeyPem",
        "proofAlgorithm": "sec:proofAlgorithm",
        "proofType": "sec:proofType",
        "proofValue": "sec:proofValue",
        "publicKey": {"@id": "sec:publicKey", "@type": "@id", "@container": "@set"},
        "publicKeyPem": "sec:publicKeyPem",
        "recommendedElector": {"@id": "wl:recommendedElectors", "@container": "@set"},
        "requireEventValidation": "wl:requireEventValidation",
        "requiredProof": "sec:requiredProof",
        "revoked": {"@id": "sec:revoked", "@type": "xsd:dateTime"},
        "seeAlso": {"@id": "rdfs:seeAlso", "@type": "@id"},
        "signature": "sec:signature",
        "signatureAlgorithm": "sec:signatureAlgorithm",
        "signatureValue": "sec:signatureValue",
        "supportedEventType": "wl:supportedEventType",
        "voteRound": {"@id": "wl:voteRound", "@type": "xsd:integer"},
        "voter": {"@id": "wl:voteRound", "@type": "@id"}
    }
}


api.create = options => {
  let did = 'did:v1:testnet:' + (options.did || uuid());
  let hostname = 'testnet.veres.one';

  if(options.mode === 'dev') {
    hostname = 'veres.one.local:42443';
    request = request.defaults({json: true, strictSSL: false});
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
        nParam = 64;
        kParam = 3;
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
    }],
    saveConfig: ['postDidDocument', (results, callback) => {
      const didDocument = _.cloneDeep(results.ledgerEvent.input[0]);
      didDocument.authenticationCredential[0].privateKeyPem =
        pki.privateKeyToPem(results.generateKeyPair.privateKey);

      keyStorage.store(didDocument, callback);
    }]
  }, (err, results) => {
    if(err) {
      return console.error(
        'Failed to register DID Document', err);
    }

    if(results.postDidDocument.statusCode === 202) {
      console.log('DID creation successful!');
      console.log('DID Document stored in:', results.saveConfig);
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
