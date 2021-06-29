/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const v1 = require('did-veres-one');
const https = require('https');
const {VeresOneDidDoc} = v1;
const jsonld = require('jsonld');
const logger = require('./logger');

const DEFAULT_MODE = 'test';

// Did document status
const PENDING = 'pending';
const REGISTERED = 'registered';

const {didStore, keyStore, metaStore, allDidMethods} = require('../../storage');

const api = {};
module.exports = api;

const _keyTypes = {
  ed25519: 'Ed25519VerificationKey2018',
  rsa: 'RsaVerificationKey2018'
};

function driver({mode, hostname}) {
  // TODO: Support custom httpsAgent?
  const httpsAgent = new https.Agent({rejectUnauthorized: mode !== 'dev'});

  return v1.driver({mode, hostname, httpsAgent});
}

/**
 * @param {string} [type='veres'] - DID type / method.
 * @param {string} [mode='test'] - Ledger mode (test/live/dev).
 *
 * @returns {{pending: FlexDocStore, registered: FlexDocStore}}
 */
function didStoreFor({type = 'veres', mode = 'test'}) {
  return {
    pending: didStore({type, mode, status: PENDING}),
    registered: didStore({type, mode, status: REGISTERED})
  };
}

function displayDidDoc({options, didDocument, status, meta}) {
  // TODO: Add registration status and local metadata to result.
  logger._log(options, JSON.stringify(didDocument, null, 2));
  logger._log(options, 'STATUS:', status);
  logger._log(options, 'METADATA:', JSON.stringify(meta, null, 2));
}

/**
 * @param {string} did - DID url.
 * @param {VeresOne} veresDriver
 * @param {string} [type='veres'] - DID type / method.
 * @param {string} [mode='test'] - Ledger mode (test/live/dev), if applicable.
 *
 * @returns {Promise<{meta: object, didDocument: object, status: string}>}
 */
async function loadDidDocument({
  did, veresDriver, type = 'veres', mode = 'test'}) {
  // Load metadata (to see if it's been published, etc)
  const meta = (await metaStore().get(did)) || {};

  let status;
  let didDocument;

  if(meta.published) {
    status = REGISTERED;
    didDocument = await veresDriver.get({did});
  } else {
    status = PENDING;
    const doc = await didStore({type, mode, status: PENDING}).get(did);
    didDocument = new VeresOneDidDoc({doc});
  }

  await didDocument.importKeys(await keyStore().get(did));

  return {status, didDocument, meta};
}

/**
 * @param {VeresOneDidDoc} didDocument
 * @param {string} status - registered/pending.
 * @param {string} [type='veres'] - DID type / method.
 * @param {string} [mode='test'] - Ledger mode (test/live/dev).
 * @param {VeresOne} veresDriver
 * @returns {Promise<void>}
 */
async function saveDidDocument({
  didDocument, status, type = 'veres', mode = 'test', veresDriver}) {
  if(status === PENDING) {
    const did = didDocument.id;
    return didStore({type, mode, status: PENDING}).put(did, didDocument);
  }
  // REGISTERED
  return veresDriver.update({didDocument});
}

/**
 * @param {object} options
 *
 * DID Type / method:
 * @param {string} [options.type='veres'] - DID type / method.
 * @param {string} [options.mode='test'] - Ledger mode (test/live/dev), if
 *   applicable.
 * @param {string} [options.hostname] - Ledger node hostname override
 * @param {string} [options.auth] - Authorization DID.
 * @param {string} [options.accelerator] - Accelerator hostname[:port].
 * @param {boolean} [options.register=false]
 *
 * Key:
 * @param {string} [options.keytype='ed25519'] - Key type.
 * @param {string} [options.passphrase]
 *
 * Descriptive metadata (not stored in DID itself):
 * @param {string} [options.name]
 * @param {string} [options.description]
 * @param {string} [options.notes]
 *
 * @returns {Promise}
 */
api.generate = async options => {
  const {type, mode, hostname, passphrase} = options;
  const veresDriver = driver({mode, hostname});
  const dids = didStoreFor({type, mode});

  const keyType = _keyTypes[options.keytype];

  // check known key types
  if(!keyType) {
    throw new Error('Unknown key type.');
  }

  // generate a DID Document
  const {didDocument, keyPairs} =
    await veresDriver.generate({keyType, passphrase});
  const {id: did} = didDocument;
  logger._log(options, 'Generated a new Veres One DID: ' + did);

  console.log(JSON.stringify({didDocument, keyPairs}, null, 2));

  // set explicit notes and metadata
  const meta = {};
  jsonld.addValue(meta, 'created', new Date().toISOString());
  jsonld.addValue(meta, 'ledger', type);
  jsonld.addValue(meta, 'ledgerMode', mode);
  if(options.name) {
    logger._debug(options, 'adding "name" note');
    jsonld.addValue(meta, 'name', options.name);
  }
  if(options.description) {
    logger._debug(options, 'adding "description" note');
    jsonld.addValue(meta, 'description', options.description);
  }

  // Save keys
  await keyStore().put(did, _exportPrivateKeys({keyPairs}));
  await dids.pending.put(did, didDocument);

  if(options.register) {
    await veresDriver.register({didDocument, keyPairs});
    // Move DID Document from 'pending' store to 'registered'
    await dids.registered.put(did, didDocument);
    await dids.pending.remove(did);

    jsonld.addValue(meta, 'published', new Date().toISOString());
    if(hostname) {
      jsonld.addValue(meta, 'publishedHost', hostname);
    }

    logger._log(options, 'Registered.');
  } else {
    logger._log(
      options, 'To register the DID globally, use the `register` command.');
  }
  // Save metadata / notes
  await metaStore().put(did, meta);
};

/**
 * @param {object} options
 * @param {string} options.did - DID to register.
 *
 * Ledger:
 * @param {string} [options.type='veres'] - DID type / method.
 * @param {string} [options.mode='test'] - Ledger mode (test/live/dev).
 * @param {string} [options.hostname] - Ledger node hostname override.
 * @param {string} [options.auth] - Authorization DID.
 * @param {string} [options.accelerator] - Accelerator hostname[:port].
 * @returns {Promise}
 */
api.register = async options => {
  const {did, type, mode, hostname} = options;
  if(!did) {
    throw new Error('Cannot register - missing DID.');
  }

  const veresDriver = driver({mode, hostname});
  const dids = didStoreFor({type, mode});

  logger._debug(options, 'registering DID', did);

  const doc = await dids.pending.get(did);
  if(!doc) {
    throw new Error(`DID ${did} not found.`);
  }

  const didDocument = new VeresOneDidDoc({doc});
  logger._debug(options, 'Loading keys for DID', did);
  await didDocument.importKeys(await keyStore().get(did));

  console.log('Registering:', didDocument);

  await veresDriver.register({didDocument});
  logger._debug('Registered DID ', did);

  // Move DID Document from 'pending' store to 'registered'
  await dids.registered.put(did, didDocument);
  await dids.pending.remove(did);

  // Update metadata to reflect published status
  let meta = (await metaStore().get(did));
  if(!meta) {
    meta = {};
    jsonld.addValue(meta, 'ledger', type);
    jsonld.addValue(meta, 'ledgerMode', mode);
  }
  jsonld.addValue(meta, 'published', new Date().toISOString());
  if(hostname) {
    jsonld.addValue(meta, 'publishedHost', hostname);
  }
  // Save updated metadata / notes
  await metaStore().put(did, meta);
};

/* eslint-disable-next-line no-unused-vars */
api.receive = async options => {
  throw new Error('receive not implemented');
};

/*
api.revoke = async options => {
  throw new Error('revoke not implemented');
};
*/

/**
 * @param {object} options
 *
 * @param {string} options.did - DID URI.
 * @param {string} [options.type='veres'] - DID type / method.
 * @param {string} [options.mode='test'] - Ledger mode (test/live/dev), if
 *   applicable.
 * @param {string} [options.hostname] - Ledger node hostname override
 *
 * @returns {Promise}
 */
api.info = async options => {
  const {did, type, mode, hostname} = options;

  logger._verbose(options, 'DID:', did);

  const veresDriver = driver({mode, hostname});

  const {meta, didDocument, status} =
    await loadDidDocument({did, veresDriver, type, mode});

  displayDidDoc({options, didDocument, status, meta});
};

function _showNote(did, notes, property, options) {
  const fmt = options.format;
  if(fmt === 'plain') {
    const properties = property ? [property] : Object.keys(notes).sort();
    for(const p of properties) {
      console.log(`${did} ${p} ${notes[p]}`);
    }
  } else if(fmt === 'json' || fmt === 'json-compact') {
    const json = Object.assign({}, notes);
    json.id = did;
    if(fmt === 'json') {
      console.log(JSON.stringify(json, null, 2));
    } else {
      console.log(JSON.stringify(json));
    }
  }
}

function _notesOne(did, config, options) {
  // run commands in order: clear, add, remove, set, delete, find
  logger._debug(options, 'notes: processing did', {did});

  let store = false;

  // only allow mutable operations if did or --all specified
  const readonly = !(options.did || options.all);
  if(readonly && (options.clear ||
    options.add || options.remove ||
    options.set || options.delete)) {
    throw new Error('readonly mode: specify DID or use --all');
  }

  if(options.clear) {
    delete config.dids[did];
    store = true;
  }
  const target = config.dids[did] = config.dids[did] || {};

  if(options.add) {
    if(options.add[0] === 'id' || options.add[0] === '@id') {
      throw new Error('Can not add "id"');
    }
    jsonld.addValue(
      target, options.add[0], options.add[1], {allowDuplicate: false});
    store = true;
  }
  if(options.remove) {
    if(options.remove[0] === 'id' || options.remove[0] === '@id') {
      throw new Error('Can not remove "id"');
    }
    jsonld.removeValue(target, options.remove[0], options.remove[1]);
    store = true;
  }
  if(options.get) {
    if(options.get in target) {
      _showNote(did, target, options.get, options);
    }
  }
  if(options.set) {
    if(options.set[0] === 'id' || options.set[0] === '@id') {
      throw new Error('Can not set "id"');
    }
    target[options.set[0]] = options.set[1];
    store = true;
  }
  if(options.delete) {
    delete target[options.delete];
    store = true;
  }
  if(options.find) {
    if(options.find[0] in target &&
      jsonld.hasValue(target, options.find[0], options.find[1])) {
      console.log(did);
    }
  }

  // if no options, show all notes
  if(!options.clear &&
    !options.add && !options.remove &&
    !options.set && !options.get && !options.delete &&
    !options.find) {
    _showNote(did, target, null, options);
  }

  // remove if all properties gone
  if(Object.keys(target).length === 0) {
    delete config.dids[did];
    store = true;
  }

  return store;
}

api.notes = async options => {
  // const release = await _config._lockConfig(options);
  // const config = await _config._loadConfig(options);
  //
  // let store = false;
  // if(options.did) {
  //   store = _notesOne(options.did, config, options);
  // } else {
  //   for(const did of Object.keys(config.dids).sort()) {
  //     store = _notesOne(did, config, options) || store;
  //   }
  // }
  //
  // if(store) {
  //   await _config._storeConfig(config, options);
  // }
  // return await release();
};

/**
 * @param options
 * @param {string} options.keyId - Id of the existing key to rotate.
 * @param {string} [options.mode='test'] - Ledger mode (test/live/dev), if
 *   applicable.
 * @param {string} [options.hostname] - Ledger node hostname override
 * @param {string} [options.type='veres'] - DID type / method.
 *
 * @returns {Promise}
 */
api.rotate = async options => {
  const {mode, hostname, type, keyId} = options;
  const veresDriver = driver({mode, hostname});

  const did = keyId.split('#')[0];

  const {status, didDocument, meta} =
    await loadDidDocument({did, veresDriver, mode, type});

  await didDocument.rotateKey({id: keyId});

  await saveDidDocument({didDocument, status, type, mode, veresDriver});
  logger._log(options, 'Saved updated document.');

  // Update was successful, save new private key to key store
  await keyStore().put(did, _exportPrivateKeys({didDocument}));
  logger._log(options, 'Saved new private key to local key store.');

  // TODO: Update metadata (to record rotate event)
  // jsonld.addValue(meta, 'rotateEvent', {});

  // Display the DID Doc with the newly rotated key
  displayDidDoc({options, didDocument, status, meta});
};

api.list = async () => {
  const methods = await allDidMethods();
  for(const method of methods) {
    const [type, mode] = method.split('-');

    console.log(`${method} DIDs:`);

    // Print pending DIDs
    const pendingDids = didStore({type, mode, status: PENDING});
    const {
      total_rows: totalPending, rows: pendingRows
    } = await pendingDids.allDocs();
    console.log(`  Pending: ${totalPending}`);
    for(const row of pendingRows) {
      console.log(`    ${row.id}`);
    }

    // Print registered DIDs
    const registeredDids = didStore({type, mode, status: REGISTERED});
    const {
      total_rows: totalRegistered, rows: registeredRows
    } = await registeredDids.allDocs();
    console.log(`  Registered: ${totalRegistered}`);
    for(const row of registeredRows) {
      console.log(`    ${row.id}`);
    }
  }
};

/**
 * @param options
 * @param options.did
 * @param options.type
 * @param options.mode
 * @returns {Promise<void>}
 */
api.remove = async options => {
  const {did} = options;
  // Load metadata (to see if it's been published, etc)
  const meta = (await metaStore().get(did)) || {};

  if(meta.published) {
    throw new Error('Removing published DIDs is not supported.');
  }

  const type = options.type || meta.ledger;
  const mode = options.mode || meta.ledgerMode || DEFAULT_MODE;

  // Remove pending DID
  const pendingDids = didStore({type, mode, status: PENDING});
  await pendingDids.remove(did);
  await keyStore().remove(did);
  await metaStore().remove(did);

  console.log('Removed.');
};

function _exportPrivateKeys({keyPairs}) {
  const allPrivateKeys = {};

  for(const [id, privateKey] of keyPairs) {
    allPrivateKeys[id] = privateKey.export({publicKey: true, privateKey: true});
  }

  return allPrivateKeys;
}
