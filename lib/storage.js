/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */

// TODO: use native promisify once node 8+ required
const promisify = require('util.promisify');

const fs = require('fs-extra');
const glob = promisify(require('glob'));
const mkdirp = require('mkdirp-promise');
const os = require('os');
const path = require('path');
const util = require('./util');

const api = {};
module.exports = api;

function _didDir() {
  return path.join(os.homedir(), '.did');
}

function _didToFilename(did) {
  return path.join(_didDir(), did.replace(/:/g, '-'));
}

api.store = util.callbackify(async function(didDocument, options = {}) {
  // TODO: validate params

  const did = didDocument.id;

  if(!did) {
    throw new Error('DID Document missing `id` field: ' + didDocument);
  }

  const didFilename = _didToFilename(did);

  // create .did directory, write file, make read-only
  await mkdirp(path.dirname(didFilename), {mode: '0700'});
  await fs.writeFile(didFilename, JSON.stringify(didDocument, null, 2), 'utf8');
  await fs.chmod(didFilename, '0400');

  return didFilename;
});

async function _loadFile(filename) {
  const data = await fs.readFile(filename, 'utf8');
  return JSON.parse(data);
}

api.load = util.callbackify(async function(did, options = {}) {
  const didFilename = _didToFilename(did);
  return _loadFile(didFilename);
});

api.remove = util.callbackify(async function(did, options = {}) {
  throw new Error('Key storage .remove() not implemented');
});

api.list = util.callbackify(async function(options = {}) {
  // FIXME: be more async (streams, generators, etc)
  // FIXME: skip cruft
  const files = await glob(path.join(_didDir(), 'did-*'));
  const ids = [];
  for(const f of files) {
    const data = await _loadFile(f);
    ids.push(data.id);
  }
  return ids;
});

api.meta = util.callbackify(async function(did, options = {}) {
  const filename = _didToFilename(did);
  return {
    did,
    filename: filename,
    data: await _loadFile(filename)
  };
});
