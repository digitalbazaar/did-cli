/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const path = require('path');
const {promisify} = require('util');
const glob = promisify(require('glob'));
const {FlexDocStore: Store} = require('flex-docstore');
const os = require('os');

/**
 * By default, everything is stored in `~/.dids/`.
 * Filenames are URL-encoded (since the `:` and `#` characters commonly used
 * in DIDs are often reserved file system characters).
 *
 * Keys are stored in `~/.dids/keys/`, and are organized by DID. For example,
 * a key with ID of `did:example:abcd#efgh` will be stored in:
 * `~/.dids/keys/did%3Aexample%3Aabcd.keys.json`
 *
 * Notes and other metadata are stored in ~/.dids/meta/`, and are organized
 * by DID.
 *
 * DID Documents are stored in `~/.dids/<method>-<mode>/<status>/`
 * (where `mode` is `test`/`live` etc, `status` is 'pending' or 'registered'),
 * and are organized by DID.
 *
 * When a DID is first generated (but not registered), it's stored in `pending/`
 * directory. As soon as it's registered, it's moved to the `registered/` dir.
 * After registration, only the ledger version is authoritative, and the copy
 * saved in the `registered/` dir is just for reference, similar to an email
 * in the Sent folder.
 *
 * So, for example, a Veres One 'dev' mode DID 'did:v1:nym:abc' that was created
 * but not registered would be stored in:
 *
 * `~/.dids/veres-dev/pending/did%3Av1%3Anym%3Aabc.json`
 *
 * As soon as it's registered, it would be moved to:
 *
 * `~/.dids/veres-dev/registered/`
 *
 * Example Usage:
 *
 * ```
 * // Write to the store
 * await didStore.put(did, didDoc);
 *
 * // Read from store
 * const didDocJson = await didStore.get(did);
 *
 * // Remove from store
 * await didStore.remove(did);
 *
 * // Read a non-existent key
 * const result = await didStore.get(deletedDid);
 * // result -> null  (does not throw an error)
 * ```
 *
 * @param [options.type] {string} DID method / type, for example, 'veres'
 * @param [options.mode] {string} 'test'/'live'
 */
function didStore(options) {
  const {type, mode} = options;
  const status = options.status || '';
  const dir = options.dir ||
    path.join(os.homedir(), '.dids', `${type}-${mode}`, status);
  const extension = '.json';
  return Store.using('files', {dir, extension, ...options});
}

/**
 * @param options
 *
 * Example usage:
 *
 * ```
 * console.log(await allDidMethods());
 * // ->
 * // [ 'veres-live', 'veres-test' ]
 * ```
 *
 * @returns {Promise<Array<string>>}}
 */
async function allDidMethods(options = {}) {
  const dir = options.dir || path.join(os.homedir(), '.dids/');
  const methods = (await glob(path.join(dir, '*')))
    // filter out keys/meta dirs
    .filter(d => !(d.endsWith('keys') || d.endsWith('meta')))
    .map(d => d.replace(dir, ''));

  return methods;
}

function keyStore(options = {}) {
  const dir = options.dir ||
    path.join(os.homedir(), '.dids', 'keys');
  const extension = '.keys.json';
  return Store.using('files', {dir, extension, ...options});
}

function metaStore(options = {}) {
  const dir = options.dir ||
    path.join(os.homedir(), '.dids', 'meta');
  const extension = '.meta.json';
  return Store.using('files', {dir, extension, ...options});
}

module.exports = {
  allDidMethods,
  didStore,
  keyStore,
  metaStore
};
