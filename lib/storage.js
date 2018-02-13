/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
const fs = require('fs-extra');
const mkdirp = require('mkdirp-promise');
const os = require('os');
const path = require('path');
const util = require('./util');

const api = {};
module.exports = api;

api.store = util.callbackify(async function(didDocument, options = {}) {
  // TODO: validate params

  const did = didDocument.id;
  const didFilename = path.join(os.homedir(), '.did', did.replace(/:/g, '-'));

  if(!did) {
    throw new Error('DID Document missing `id` field: ' + didDocument);
  }

  // create .did directory, write file, make read-only
  await mkdirp(path.dirname(didFilename), {mode: '0700'});
  await fs.writeFile(didFilename, JSON.stringify(didDocument, null, 2), 'utf8');
  await fs.chmod(didFilename, '0400');

  return didFilename;
});

api.load = util.callbackify(async function(did, options) {
  throw new Error('Key storage .load() not implemented');
});
