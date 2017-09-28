/*!
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const fs = require('fs');
const mkdirp = require('mkdirp');
const os = require('os');
const path = require('path');

const api = {};
module.exports = api;

api.store = (didDocument, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  const did = didDocument.id;
  const didFilename = path.join(os.homedir(), '.did', did.replace(/:/g, '-'));

  if(!did) {
    return callback(
      new Error('DID Document missing `id` field: ' + didDocument));
  }

  async.auto({
    // create .did directory
    mkdir: callback =>
      mkdirp(path.dirname(didFilename), {mode: 0700}, callback),
    write: ['mkdir', (results, callback) =>
      fs.writeFile(
        didFilename, JSON.stringify(didDocument, null, 2),
        'utf8', callback)],
    chmod: ['write', (results, callback) =>
      fs.chmod(didFilename, 0400, callback)]
  }, (err, results) => {
    if(err) {
      return callback(
        new Error('DID Document storage failed: ' + err));
    }

    callback(null, didFilename);
  });
};

api.load = (did, options, callback) => {
  callback(new Error('Key storage .load() not implemented'));
};
