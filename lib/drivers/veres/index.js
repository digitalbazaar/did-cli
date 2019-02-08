/*!
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const chalk = require('chalk');
const _config = require('./config');
const didv1 = require('did-veres-one');
const didcv1 = require('did-client-veres-one');
const jsonld = require('jsonld');
const helpers = require('./helpers');
const logger = require('./logger');
const fs = require('fs');
const keyStorage = require('../../storage');
const {promisify} = require('util');
const _send = require('./send');
const {VeresOne} = didv1;

const readFile = promisify(fs.readFile);

const api = {
  'ed25519-key-add': require('./ed25519-key-add'),
};
module.exports = api;

// known testnet hostnames (as of 2018-02)
const _testnetHostnames = [
  'alturas',
  'frankfurt',
  'genesis',
  'mumbai',
  'saopaulo',
  'singapore',
  'tokyo'
].map(nick => `${nick}.testnet.veres.one`);

// get all mode hostnames
function _getModeHostnames(options) {
  if(options.mode === 'test') {
    return _testnetHostnames;
  } else {
    return [helpers._getDefaultHostname(options)];
  }
}

// get default hostname or all overrides
function _getHostnames(options) {
  const optHostnames = helpers._getOptionHostnames(options);
  if(optHostnames.length > 0) {
    return optHostnames;
  }
  return [helpers._getDefaultHostname(options)];
}

const _keyTypes = {
  ed25519: 'Ed25519VerificationKey2018',
  rsa: 'RsaVerificationKey2018'
};

api.generate = async options => {
  // called to check hostname set properly
  const hostname = helpers._getHostname(options);
  const v1 = didv1.veres({
    hostname,
    mode: options.mode
  });

  // check known key types
  if(!(options.type in _keyTypes)) {
    throw new Error('Unknown key type');
  }

  logger._log(options, 'Generating a new Veres One DID...');
  logger._log(options, 'Generating keypair... (5-15 seconds)');

  // generate a DID Document
  let passphrase = options.passphrase;
  if(passphrase === undefined) {
    passphrase = null;
  }
  // const {publicDidDocument: didDocument, privateDidDocument} =
  //   await didv1.generate(
  //     {keyType: _keyTypes[options.type], passphrase});

  const didDocument = await v1.generate({});

  logger._log(options, `DID: ${didDocument.id}`);

  // FIXME: encrypt private key pair
  /*
  if(options.import) {
    await _import(options, privateDidDocument);
  } else {
    console.log(JSON.stringify(privateDidDocument, null, 2));
  }
  */

  // get config
  const release = await _config._lockConfig(options);
  const config = await _config._loadConfig(options);

  // set explicit notes
  const notes = {};
  if(options.name) {
    logger._debug(options, 'adding "name" note');
    jsonld.addValue(notes, 'name', options.name);
  }
  if(options.description) {
    logger._debug(options, 'adding "description" note');
    jsonld.addValue(notes, 'description', options.description);
  }
  // check if ok to set auto notes
  if(options.notes) {
    if(jsonld.hasValue(config, 'urn:did-client:notes:auto', 'created')) {
      jsonld.addValue(notes, 'created', new Date().toISOString());
    }
  }
  await release();
  await helpers._notesAddMany(didDocument.id, notes, options);

  logger._log(options, 'Local DID generation successful.');

  if(options.register) {
    await _send({options, didDocument, v1/* , privateDidDocument*/});
  } else {
    logger._log(
      options, 'To register the DID globally, use the `register` command.');
  }
};

api.import = async options => {
  let data;
  if(options.filename) {
    logger._debug(options, 'import from file', {filename: options.filename});
    data = await readFile(options.filename);
  } else {
    logger._debug(options, 'import from stdin');
    const getStdin = require('get-stdin');
    data = await getStdin();
  }
  const privateDidDocument = JSON.parse(data);
  await helpers._import(options, privateDidDocument);
  const didDocument = await didv1.publicDidDocument({privateDidDocument});
  if(options.register) {
    await _send({options, didDocument, privateDidDocument});
  }
};

api.export = async options => {
  const v1 = new VeresOne();
  const privateDidDocument = await v1.getLocal({did: options.did});
  if(options.private) {
    logger._debug(options, 'export private');
    const {doc, keys} = privateDidDocument;
    console.log(JSON.stringify({doc, keys}, null, 2));
    return;
  }
  if(options.public) {
    logger._debug(options, 'export public');
    console.log(JSON.stringify(privateDidDocument, null, 2));
    return;
  }
};

api.register = async options => {
  let privateDidDocument;
  if(options.did) {
    logger._debug(options, 'register DID', {did: options.did});
    privateDidDocument = await keyStorage.load(options.did);
  } else {
    const getStdin = require('get-stdin');
    privateDidDocument = JSON.parse(await getStdin());
    logger._debug(
      options, 'register DID from stdin', {did: privateDidDocument.id});
  }
  const didDocument = await didv1.publicDidDocument({privateDidDocument});
  return _send({options, didDocument, privateDidDocument});
};

api.receive = async options => {
  throw new Error('receive not implemented');
};

/*
api.revoke = async options => {
  throw new Error('revoke not implemented');
};
*/

async function _getLocal(did, options) {
  const v1 = new VeresOne();
  logger._verbose(options, 'Retrieving local DID Document...');
  let timeMs;
  try {
    const start = new Date();
    const result = await v1.getLocal({did});
    timeMs = new Date() - start;
    return {
      found: true,
      timeMs,
      type: 'LocalDidDocument',
      did,
      // doc, meta, observer, keys
      ...result
    };
  } catch(err) {
    return {
      found: false,
      // don't retry local files
      retry: false,
      time: timeMs,
      type: 'LocalDidDocument',
      did,
      error: err
    };
  }
}

async function _getLedger(did, hostname, reqOptions, options) {
  logger._verbose(options, 'Retrieving remote DID Document...', {hostname});
  const v1 = new VeresOne({hostname, mode: options.mode});
  return v1.getRemote({did});
}

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
  const release = await _config._lockConfig(options);
  const config = await _config._loadConfig(options);

  let store = false;
  if(options.did) {
    store = _notesOne(options.did, config, options);
  } else {
    for(const did of Object.keys(config.dids).sort()) {
      store = _notesOne(did, config, options) || store;
    }
  }

  if(store) {
    await _config._storeConfig(config, options);
  }
  return await release();
};

function _removeKeyId(didDocument, id) {
  // check all suites
  for(const suiteId of helpers._suiteIds) {
    for(const suiteParams of jsonld.getValues(didDocument, suiteId)) {
      suiteParams.publicKey = jsonld.getValues(suiteParams, 'publicKey')
        .filter(key => key.id !== id);
    }
  }
}

api['authn-remove'] = async options => {
  logger._debug(options, 'authn-remove', {did: options.did, key: options.key});
  const did = options.did;
  // lock local
  const release = await helpers._lockDid(did, options);
  // get local did doc
  const privateDidDocument = await keyStorage.load(did);
  // get remote did doc
  const hostname = helpers._getHostname(options);
  const didDocument = await didcv1.getObservable(
    {did, hostname, env: options.mode});

  // FIXME: move most of this to ext library
  // remove key
  _removeKeyId(privateDidDocument, options.key);
  _removeKeyId(didDocument, options.key);

  // FIXME: reusing import code, rename it
  helpers._import(options, privateDidDocument);

  await release();

  logger._log(options, 'DID local update successful.');

  // if(options.send) {
  await _send(
    {options, didDocument, privateDidDocument, operationType: 'update'});
  // }
};

api['authn-rotate'] = async options => {
  // TODO: remove old, add new, track old id as used, rovoke old
  throw new Error('authn-rotate not implemented');
};

api['ocap-add'] = async options => {
  throw new Error('ocap-add not implemented');
};

api['ocap-revoke'] = async options => {
  throw new Error('ocap-add not implemented');
};
