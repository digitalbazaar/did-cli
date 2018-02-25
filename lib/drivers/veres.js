/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const chalk = require('chalk');
const didv1 = require('did-veres-one');
const didcv1 = require('did-client-veres-one');
const keyStorage = require('../storage');
const r2 = require('r2');

// configure libraries
const jsonld = require('jsonld')();
const documentLoader = jsonld.documentLoader;
jsonld.documentLoader = async url => {
  if(url in didv1.contexts) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: didv1.contexts[url]
    };
  }
  return documentLoader(url);
};
const jsigs = require('jsonld-signatures');
jsigs.use('jsonld', jsonld);
const eproofs = require('equihash-signature');
eproofs.install(jsigs);
didv1.use('jsonld', jsonld);
didv1.use('jsonld-signatures', jsigs);

const api = {};
module.exports = api;

function __log(options, f, msg, ...rest) {
  f(
    `[${chalk.bold('Veres One')}][${chalk.bold(options.mode)}] ${msg}`,
    ...rest);
}

function _log(options, ...rest) {
  __log(options, console.log, ...rest);
}

function _error(options, ...rest) {
  __log(options, console.error, chalk.bold.red('ERROR'), ...rest);
}

function _debug(options, ...rest) {
  if(options.verbose >= 2) {
    _log(options, ...rest);
  }
}

function _verbose(options, ...rest) {
  if(options.verbose >= 1) {
    _log(options, ...rest);
  }
}

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

// get default mode hostname
function _getDefaultHostname(options) {
  if(options.mode === 'dev') {
    return 'genesis.veres.one.localhost:42443';
  } else if(options.mode === 'test') {
    return 'genesis.testnet.veres.one';
  } else if(options.mode === 'live') {
    return 'veres.one';
  } else {
    throw new Error('Unknown mode');
  }
}

// get all mode hostnames
function _getModeHostnames(options) {
  if(options.mode === 'test') {
    return _testnetHostnames;
  } else {
    return [_getDefaultHostname(options)];
  }
}

// get option hostnames
function _getOptionHostnames(options) {
  const hostnames = options.hostname || [];
  return Array.isArray(hostnames) ? hostnames : [hostnames];
}

// get single hostname, allow single override
function _getHostname(options) {
  const optHostnames = _getOptionHostnames(options);
  if(optHostnames.length > 1) {
    throw new Error('Too many hostnames provided');
  }
  if(optHostnames.length === 1) {
    return optHostnames[0];
  }
  return _getDefaultHostname(options);
}

// get default hostname or all overrides
function _getHostnames(options) {
  const optHostnames = _getOptionHostnames(options);
  if(optHostnames.length > 0) {
    return optHostnames;
  }
  return [_getDefaultHostname(options)];
}

const _keyTypes = {
  ed25519: 'Ed25519VerificationKey2018',
  rsa: 'RsaVerificationKey2018'
};

async function _send(options, didDocument, privateDidDocument) {
  const hostname = _getHostname(options);

  _log(options, 'Preparing to register DID Document on Veres One...');

  // wrap DID Document in a web ledger operation
  let operation = didv1.wrap({didDocument});

  if(options.accelerator) {
    // use accelerator
    _log(options, 'Using accelerator...');
    if(!options.auth) {
      throw new Error('Authorizaion DID required');
    }
    const authDid = await keyStorage.load(options.auth);

    // send DID Document to a Veres One ledger node
    _log(options, 'Registering DID Document on Veres One...');
    _log(options, 'Generating accelerator signature...');
    const response = await didcv1.sendToAccelerator({
      operation,
      hostname: options.accelerator,
      env: options.mode,
      keyId: authDid.authentication[0].publicKey.id,
      key: authDid.authentication[0].publicKey.privateKeyPem
    });
    operation = await response.json();
  } else {
    // attach an equihash proof
    _log(options, 'Generating Equihash proof of work... (60-120 seconds)');
    operation = await didv1.attachEquihashProof({operation});
  }

  // get public key ID
  const creator = didDocument.invokeCapability[0].publicKey[0].id;

  // get private key
  const privateKey = privateDidDocument.invokeCapability[0].publicKey[0]
    .privateKey;

  // attach capability invocation proof
  _log(options, 'Attaching LD-OCAP invocation proof...');
  operation = await didv1.attachInvocationProof({
    operation,
    capability: didDocument.id,
    capabilityAction: 'RegisterDid',
    creator,
    privateKeyPem: privateKey.privateKeyPem,
    privateKeyBase58: privateKey.privateKeyBase58,
  });

  // send DID Document to a Veres One ledger node
  _log(options, 'Registering DID Document on Veres One...');
  const response = await didcv1.send({
    operation,
    hostname,
    env: options.mode
  });

  if(response.status === 204) {
    _log(options, 'DID registration successful!');
  } else {
    _error(options, 'Failed to register DID Document.');
    _error(options, 'Status Code: ' + response.status);
    _error(options, 'Response Body: ' +
      JSON.stringify(await response.json(), null, 2));
  }
}

api.create = async options => {
  // called to check hostname set properly
  _getHostname(options);

  // check known key types
  if(!(options.type in _keyTypes)) {
    throw new Error('Unknown key type');
  }

  _log(options, 'Creating new DID on Veres One...');
  _log(options, 'Generating keypair... (5-15 seconds)');

  // generate a DID Document
  const passphrase = options.passphrase === undefined || null;
  const {publicDidDocument: didDocument, privateDidDocument} =
    await didv1.generate(
      {keyType: _keyTypes[options.type], passphrase});

  _log(options, `DID: ${didDocument.id}`);

  // get public key ID and private key pem
  const creator = didDocument.invokeCapability[0].publicKey[0].id;

  // FIXME: encrypt private key pair
  // save private DID Document
  _log(options, 'Storing DID Document on disk...');
  const filename = await keyStorage.store(privateDidDocument);
  _log(options, 'DID Document stored in:', filename);
  _log(options, 'DID creation successful.');

  return _send(options, didDocument, privateDidDocument);
};

api.import = async options => {
  throw new Error('import not implemented');
};

api.export = async options => {
  throw new Error('export not implemented');
};

api.send = async options => {
  const privateDidDocument = await keyStorage.load(options.did);
  const didDocument = await didv1.publicDidDocument({privateDidDocument});
  return _send(options, didDocument, privateDidDocument);
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
  _verbose(options, 'Retrieving local DID Document...');
  try {
    const meta = await keyStorage.meta(options.did);
    return {
      found: true,
      type: 'LocalDidDocument',
      did: did,
      filename: meta.filename,
      doc: meta.doc
    };
  } catch(err) {
    return {
      found: false,
      type: 'LocalDidDocument',
      did: did,
      error: err
    };
  }
}

async function _getLedger(did, hostname, options) {
  const https = require('https');
  let agent;
  const didUrl = `https://${hostname}/dids/${did}`;
  if(options.mode === 'dev') {
    agent = new https.Agent({rejectUnauthorized: false});
  }

  _verbose(options, 'Retrieving remote DID Document...', {hostname});
  _debug(options, 'remote request', {url: didUrl});

  const response = await r2({
    url: didUrl,
    method: 'GET',
    agent,
    headers: {
      'accept': 'application/ld+json, application/json'
    }
  }).response;

  const status = response.status;
  const body = await response.json();

  if(response.status !== 200) {
    _debug(options, 'remote failure response', {hostname, status, body});
    return {
      found: false,
      type: 'LedgerDidDocument',
      did,
      hostname,
      error: {status, body}
    };
  }
  _debug(options, 'remote success response', {hostname, status});
  return {
    found: true,
    type: 'LedgerDidDocument',
    did,
    hostname,
    doc: body
  };
}

const _foundStr = chalk.bold.green('FOUND');
const _notFoundStr = chalk.bold.red('NOT FOUND');

async function _info(result, options) {
  if(options.format === 'found') {
    if(result.type === 'LocalDidDocument') {
      if(result.found) {
        _log(options, `${_foundStr} @ local`, {filename: result.filename});
      } else {
        _log(options, `${_notFoundStr} @ local`);
      }
    } else {
      if(result.found) {
        _log(options, `${_foundStr} @ ledger`, {hostname: result.hostname});
      } else {
        _log(options, `${_notFoundStr} @ ledger`, {hostname: result.hostname});
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
        console.log('Hostname:', result.filename);
      }
    }
    if(result.found) {
      const doc = result.doc;
      const auth = doc.authentication;
      console.log('DID:', doc.id);
      console.log('Authentication Count:', doc.authentication.length);
      console.log('Capability Count:', doc.invokeCapability.length);
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
    } else {
      console.log(`Result: ${_notFoundStr}`);
    }
  } else if(options.format === 'json') {
    if(result.found) {
      console.log(JSON.stringify(result.doc, null, 2));
    }
  }
}

api.info = async options => {
  _log(options, 'DID:', options.did);

  // info from requested locations
  const locations = [];

  // check local
  if(['any', 'both', 'local', 'all'].includes(options.location)) {
    locations.push(_getLocal(options.did, options));
    _verbose(options, 'searching @ local');
  }
  // fast path if local found
  let done = false;
  if(options.location === 'any') {
    const results = await Promise.all(locations);
    done = results[0].found;
  }
  // add default hostname or option hostnames
  if(!done && ['any', 'ledger', 'both'].includes(options.location)) {
    const hostnames = _getHostnames(options);
    _verbose(options, 'searching @ hostnames', hostnames);
    for(const hostname of hostnames) {
      locations.push(_getLedger(options.did, hostname, options));
    }
  }
  // add all mode hostnames and option hostnames
  if(!done && ['ledger-all', 'all'].includes(options.location)) {
    const hostnames = [
      ..._getModeHostnames(options),
      ..._getOptionHostnames(options)
    ];
    _verbose(options, 'searching @ hostnames', hostnames);
    for(const hostname of hostnames) {
      locations.push(_getLedger(options.did, hostname, options));
    }
  }

  const results = await Promise.all(locations);

  for(const result of results) {
    _info(result, options);
  }
};

api['authn-add'] = async options => {
  throw new Error('authn-add not implemented');
}

api['authn-remove'] = async options => {
  throw new Error('authn-remove not implemented');
}

api['authn-rotate'] = async options => {
  throw new Error('authn-rotate not implemented');
}

api['ocap-add'] = async options => {
  throw new Error('ocap-add not implemented');
}

api['ocap-revoke'] = async options => {
  throw new Error('ocap-add not implemented');
}
