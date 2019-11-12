/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const chalk = require('chalk');
const v1 = require('did-veres-one');
const {VeresOneDidDoc} = v1;
const jsonld = require('jsonld');
const logger = require('./logger');

const {didStore, keyStore, metaStore} = require('../../storage');

const api = {};
module.exports = api;

const _keyTypes = {
  ed25519: 'Ed25519VerificationKey2018',
  rsa: 'RsaVerificationKey2018'
};

/**
 * @param {object} options
 *
 * Ledger:
 * @param {string} [options.ledger='veres'] - Which ledger.
 * @param {string} [options.mode='test'] - Ledger mode (test/live/dev).
 * @param {string} [options.hostname] - Ledger node hostname override.
 * @param {string} [options.auth] - Authorization DID.
 * @param {string} [options.accelerator] - Accelerator hostname[:port].
 * @param {boolean} [options.register=false]
 *
 * Key:
 * @param {string} [options.type='ed25519'] - Key type.
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
  const {ledger, mode, hostname, passphrase} = options;
  if(ledger !== 'veres') {
    throw new Error(`Ledger ${ledger} not supported.`);
  }

  const veresDriver = v1.driver({mode, hostname});

  const keyType = _keyTypes[options.type];

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

  const pendingDids = didStore({ledger, mode, status: 'pending'});
  const registeredDids = didStore({ledger, mode, status: 'registered'});

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
 * @param {string} [options.ledger='veres'] - Which ledger.
 * @param {string} [options.mode='test'] - Ledger mode (test/live/dev).
 * @param {string} [options.hostname] - Ledger node hostname override.
 * @param {string} [options.auth] - Authorization DID.
 * @param {string} [options.accelerator] - Accelerator hostname[:port].
 * @returns {Promise}
 */
api.register = async options => {
  const {did, ledger, mode, hostname} = options;
  if(ledger !== 'veres') {
    throw new Error(`Ledger ${ledger} not supported.`);
  }
  if(!did) {
    throw new Error('Cannot register - missing DID.');
  }

  const pendingDids = didStore({ledger, mode, status: 'pending'});
  const registeredDids = didStore({ledger, mode, status: 'registered'});

  const veresDriver = v1.driver({mode, hostname});

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

async function _info(result, options) {
  if(options.format === 'json' && !result.found) {
    console.log(JSON.stringify({error: result.error}, null, 2));
  }
  if(options.format === 'found') {
    const info = {
      timeMs: result.timeMs
    };
    if(options.retry && result.retries > 1) {
      info.reqMs = result.reqMs;
      info.retries = result.retries;
    }
    if(result.type === 'LocalDidDocument') {
      if(result.found) {
        logger._log(options, `${_foundStr} @ local`, Object.assign({}, info, {
          filename: result.filename
        }));
      } else {
        logger._log(options, `${_notFoundStr} @ local`, info);
      }
    } else {
      const ledgerInfo = Object.assign({}, info, {
        hostname: result.hostname
      });
      if(result.found) {
        logger._log(options, `${_foundStr} @ ledger`, ledgerInfo);
      } else {
        logger._log(options, `${_notFoundStr} @ ledger`, ledgerInfo);
      }
    }
  } else if(options.format === 'human') {
    // FIXME: frame data
    if(result.type === 'LocalDidDocument') {
      console.log(`---- local ----`);
      if(result.found) {
        console.log(`Result: ${_foundStr}`);
        console.log('Filename:', result.filename);
      }
    } else {
      console.log(`---- ledger: ${result.hostname} ----`);
      if(result.found) {
        console.log(`Result: ${_foundStr}`);
        console.log('Hostname:', result.hostname);
      }
    }
    if(result.found) {
      // YAML-like output
      const doc = result.doc;
      console.log('DID:', doc.id);
      for(const suiteInfo of _suiteInfo) {
        const info = doc[suiteInfo.type] || [];
        console.log(`- ${suiteInfo.name} [${info.length}]:`);
        for(const suite of info) {
          const keys = suite.publicKey || [];
          console.log(`  Type: ${suite.type}`);
          console.log(`  Keys: [${keys.length}]`);
          for(const key of keys) {
            console.log(`  - ID: ${key.id}`);
            console.log(`    Type: ${key.type}`);
            if(options.publicKey) {
              const value = key.publicKeyBase58 || key.publicKeyPem;
              console.log(`    Public Key: ${value}`);
            }
            if(options.privateKey && key.privateKey) {
              const value =
                key.privateKey.privateKeyBase58 ||
                key.privateKey.privateKeyPem;
              console.log(`    Private Key: ${value}`);
            }
          }
        }
      }
      /*
      const auth = doc.authentication;
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
      */
    } else {
      console.log(`Result: ${_notFoundStr}`);
    }
  } else if(options.format === 'json') {
    if(result.found) {
      console.log(JSON.stringify(result.doc, null, 2));
    }
  }
}

function _delay(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

api.info = async options => {
  logger._verbose(options, 'DID:', options.did);

  // info from requested locations
  const locations = [];

  // check local
  if(['any', 'both', 'local', 'all'].includes(options.location)) {
    logger._verbose(options, 'searching @ local');
    locations.push(_getLocal(options.did, options));
  }
  // fast path if local found
  let done = false;
  if(options.location === 'any') {
    const results = await Promise.all(locations);
    done = results[0].found;
  }
  let hostnames = [];
  // add default hostname or option hostnames
  if(!done && ['any', 'ledger', 'both'].includes(options.location)) {
    hostnames = [..._getHostnames(options)];
  }
  // add all mode hostnames and option hostnames
  if(!done && ['ledger-all', 'all'].includes(options.location)) {
    hostnames = [
      ...hostnames,
      ..._getModeHostnames(options),
      ...helpers._getOptionHostnames(options)
    ];
  }
  if(!done) {
    logger._verbose(options, 'searching @ hostnames', hostnames);
    for(const hostname of hostnames) {
      locations.push(_getLedger(options.did, hostname, {
        start: new Date(),
        retries: 0
      }, options));
    }
  }

  async function looper(result) {
    if(!options.retry && !result.found) {
      return _info(result, options);
    }
    // omit "not found" info if requested
    if(!options.retryShowFound || (options.retryShowFound && result.found)) {
      _info(result, options);
    }
    // output final failure if timeout or max retries
    if(!result.found && options.retry &&
      (result.timeMs >= options.retryTimeoutMs ||
        result.retries >= options.retryMax)) {
      _info(result, options);
      return;
    }
    // retry if needed
    if(!result.found && options.retry && result.retry) {
      logger._debug(options, 'retry delay', {
        hostname: result.hostname,
        delayMs: options.retryMs
      });
      // TODO: exponential backoff
      await _delay(options.retryMs);
      return looper(await _getLedger(result.did, result.hostname, {
        start: result.start,
        retries: result.retries
      }, options));
    }
  }

  await Promise.all(locations.map(location => location.then(looper)));
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

/* eslint-disable-next-line no-unused-vars */
api['list'] = async options => {
  throw new Error('list not implemented');
};

/* eslint-disable-next-line no-unused-vars */
api['remove'] = async options => {
  throw new Error('remove not implemented');
};
