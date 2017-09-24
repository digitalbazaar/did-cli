/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const forge = require('node-forge');
const pki = forge.pki;
const rsa = forge.pki.rsa;
const uuid = require('uuid').v4;

const api = {};
module.exports = api;

api.create = options => {
  const did = 'did:v1:testnet:' + (options.did || uuid());

  console.log('Creating new DID on Veres One...');
  console.log(`  DID: ${did}`);

  rsa.generateKeyPair({bits: 2048, workers: -1}, (err, keypair) => {
    if(err) {
      return console.error('Failed to create DID', err);
    }
    // keypair.privateKey, keypair.publicKey
    const publicKeyPem = pki.publicKeyToPem(keypair.publicKey);
    const fingerprint = pki.getPublicKeyFingerprint(keypair.publicKey, {
      type: 'SubjectPublicKeyInfo',
      encoding: 'hex',
      delimiter: ':'
    });
    console.log(`  Public Key: ${fingerprint}`);

    const didDocument = {
      '@context': 'https://example.com/did/v1',
      id: did,
      authorization: [{
        permission: 'UpdateDidDescription',
        entity: did
      }],
      authenticationCredential: [{
        // this biometric can be used to authenticate as DID ...fghi
        id: did + '/keys/1',
        type: 'RsaCryptographicKey',
        owner: did,
        publicKeyPem: publicKeyPem
      }]
    };

    const signedDocument = JSON.stringify(didDocument, null, 2);

    console.log(`  DID Document: \n${signedDocument}`);
  });
};
