/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const chalk = require('chalk');
const v1 = require('did-veres-one');
const https = require('https');
const {VeresOneDidDoc} = v1;
const jsonld = require('jsonld');
const logger = require('./logger');

const {didStore, keyStore, metaStore, allDidMethods} = require('../../storage');

const api = {};
module.exports = api;

const _keyTypes = {
  ed25519: 'Ed25519VerificationKey2018',
  rsa: 'RsaVerificationKey2018'
};

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
  // TODO: Support custom httpsAgent?
  const {type, mode, hostname, passphrase} = options;
  if(type !== 'veres') {
    throw new Error(`DID type ${type} is not supported.`);
  }
  const httpsAgent = new https.Agent({rejectUnauthorized: mode !== 'dev'});
  const veresDriver = v1.driver({mode, hostname, httpsAgent});

  const keyType = _keyTypes[options.keytype];

  // check known key types
  if(!keyType) {
    throw new Error('Unknown key type.');
  }

  // generate a DID Document
  const didDocument = await veresDriver.generate({keyType, passphrase});
  const did = didDocument.id;
  logger._log(options, 'Generated a new Veres One DID: ' + did);

  console.log(JSON.stringify(didDocument, null, 2));

  // set explicit notes
  const notes = {};
  jsonld.addValue(notes, 'created', new Date().toISOString());
  if(options.name) {
    logger._debug(options, 'adding "name" note');
    jsonld.addValue(notes, 'name', options.name);
  }
  if(options.description) {
    logger._debug(options, 'adding "description" note');
    jsonld.addValue(notes, 'description', options.description);
  }

  // console.log('meta:', notes);

  // Save keys
  await keyStore().put(did, await didDocument.exportKeys());

  // Save metadata / notes
  await metaStore().put(did, notes);

  const pendingDids = didStore({type, mode, status: 'pending'});
  const registeredDids = didStore({type, mode, status: 'registered'});

  await pendingDids.put(did, didDocument);

  if(options.register) {
    await veresDriver.register({didDocument});
    // Move DID Document from 'pending' store to 'registered'
    await registeredDids.put(did, didDocument);
    await pendingDids.remove(did);
    logger._log(options, 'Registered.');
  } else {
    logger._log(
      options, 'To register the DID globally, use the `register` command.');
  }
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
  if(type !== 'veres') {
    throw new Error(`DID type ${type} is not supported.`);
  }
  if(!did) {
    throw new Error('Cannot register - missing DID.');
  }

  const pendingDids = didStore({type, mode, status: 'pending'});
  const registeredDids = didStore({type, mode, status: 'registered'});

  const httpsAgent = new https.Agent({rejectUnauthorized: mode !== 'dev'});
  const veresDriver = v1.driver({mode, hostname, httpsAgent});

  logger._debug(options, 'registering DID', did);

  const doc = await pendingDids.get(did);
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
  await registeredDids.put(did, didDocument);
  await pendingDids.remove(did);
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

const _foundStr = chalk.bold.green('FOUND');
const _notFoundStr = chalk.bold.red('NOT FOUND');

// array of suite types to display
const _suiteInfo = [
  {
    type: 'authentication',
    name: 'Authentication'
  }, {
    type: 'grantCapability',
    name: 'Grant Capability'
  }, {
    type: 'invokeCapability',
    name: 'Invoke Capability'
  }
];

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
  const {did, mode, hostname} = options;

  logger._verbose(options, 'DID:', did);

  const httpsAgent = new https.Agent({rejectUnauthorized: mode !== 'dev'});
  const veresDriver = v1.driver({mode, hostname, httpsAgent});

  // TODO: Add registration status and local metadata to result.
  const didDocument = await veresDriver.get({did});

  logger._log(options, JSON.stringify(didDocument, null, 2));
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

/* eslint-disable-next-line no-unused-vars */
api['authn-rotate'] = async options => {
  // TODO: remove old, add new, track old id as used, revoke old
  throw new Error('authn-rotate not implemented');
};

/* eslint-disable-next-line no-unused-vars */
api['ocap-add'] = async options => {
  throw new Error('ocap-add not implemented');
};

/* eslint-disable-next-line no-unused-vars */
api['ocap-revoke'] = async options => {
  throw new Error('ocap-add not implemented');
};

/**
 * @param {string} [type='veres'] - Which DID method.
 * @param {string} [mode='test'] - Ledger mode (test/live/dev).
 * @returns {Promise}
 */
api['list'] = async () => {
  const methods = await allDidMethods();
  for(const method of methods) {
    const [type, mode] = method.split('-');

    console.log(`${method} DIDs:`);

    // Print pending DIDs
    const pendingDids = didStore({type, mode, status: 'pending'});
    const {
      total_rows: totalPending, rows: pendingRows
    } = await pendingDids.allDocs();
    console.log(`  Pending: ${totalPending}`);
    for(const row of pendingRows) {
      console.log(`    ${row.id}`);
    }

    // Print registered DIDs
    const registeredDids = didStore({type, mode, status: 'registered'});
    const {
      total_rows: totalRegistered, rows: registeredRows
    } = await registeredDids.allDocs();
    console.log(`  Registered: ${totalRegistered}`);
    for(const row of registeredRows) {
      console.log(`    ${row.id}`);
    }
  }
};

/* eslint-disable-next-line no-unused-vars */
api['remove'] = async options => {
  throw new Error('remove not implemented');
};
