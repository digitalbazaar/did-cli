/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
const keyStorage = require('./storage');
const util = require('./util');

const api = {};
module.exports = api;

api.list = util.callbackify(async function(options = {}) {
  const dids = await keyStorage.list();
  for(const did of dids) {
    if(options.filename) {
      const meta = await keyStorage.meta(did);
      console.log(meta.filename);
    } else {
      console.log(did);
    }
  }
});

api.remove = util.callbackify(async function(did, options = {}) {
  throw new Error('remove not implemented');
});

api.info = util.callbackify(async function(did, options = {}) {
  const meta = await keyStorage.meta(did);
  const data = meta.data;
  const auth = data.authentication;
  if(options.format === 'human') {
    // FIXME: frame data
    console.log('DID:', meta.did);
    console.log('Filename:', meta.filename);
    console.log('Authentication Count:', meta.data.authentication.length);
    console.log('Capability Count:', meta.data.invokeCapability.length);
    if(options.publicKey && auth && auth.length > 0) {
      console.log('Public Key #1:');
      console.log('ID:', auth[0].publicKey.id);
      console.log('Type:', auth[0].publicKey.type);
      console.log('Owner:', auth[0].publicKey.owner);
      console.log(auth[0].publicKey.publicKeyPem);
    }
    if(options.privateKey && auth && auth.length > 0) {
      console.log('Private Key #1:');
      console.log('ID:', auth[0].publicKey.id);
      console.log('Type:', auth[0].publicKey.type);
      console.log('Owner:', auth[0].publicKey.owner);
      console.log(auth[0].publicKey.privateKeyPem);
    }
  } else if(options.format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  }
});
