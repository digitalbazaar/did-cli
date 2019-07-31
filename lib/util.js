/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const {expand} = require('jsonld');
const url = require('url');

const api = {};
module.exports = api;

// capture the global reference to guard against fakeTimer mocks
const _setImmediate = typeof setImmediate === 'function' && setImmediate;

const _delay = _setImmediate ?
  // not a direct alias (for IE10 compatibility)
  fn => _setImmediate(fn) :
  fn => setTimeout(fn, 0);

if(typeof process === 'object' && typeof process.nextTick === 'function') {
  api.nextTick = process.nextTick;
} else {
  api.nextTick = _delay;
}
api.setImmediate = _setImmediate ? _delay : api.nextTick;

/**
 * Clones a value. If the value is an array or an object it will be deep cloned.
 *
 * @param value the value to clone.
 *
 * @return the cloned value.
 */
api.deepClone = value => {
  if(value && typeof value === 'object') {
    let rval;
    if(Array.isArray(value)) {
      rval = new Array(value.length);
      for(let i = 0; i < rval.length; ++i) {
        rval[i] = api.deepClone(value[i]);
      }
    } else {
      rval = {};
      for(const j in value) {
        rval[j] = api.deepClone(value[j]);
      }
    }
    return rval;
  }
  return value;
};

api.callbackify = fn => {
  return async function(...args) {
    const callback = args[args.length - 1];
    if(typeof callback === 'function') {
      args.pop();
    }

    let result;
    try {
      result = await fn.apply(null, args);
    } catch(e) {
      if(typeof callback === 'function') {
        return _invokeCallback(callback, e);
      }
      throw e;
    }

    if(typeof callback === 'function') {
      return _invokeCallback(callback, null, result);
    }

    return result;
  };
};

api.normalizeAsyncFn = (fn, promiseFnLength) => {
  // ensure promise-based function can be called with a callback
  if(fn.length <= promiseFnLength) {
    return api.callbackify(fn);
  }

  // ensure callback-based function will return a Promise
  return async function(...args) {
    const callback = arguments[promiseFnLength];
    if(typeof callback === 'function') {
      args.pop();
    }
    return new Promise((resolve, reject) => {
      args.push((err, result) => {
        if(typeof callback === 'function') {
          return _invokeCallback(callback, err, result);
        } else if(err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
      try {
        fn.apply(null, args);
      } catch(e) {
        if(typeof callback === 'function') {
          return _invokeCallback(callback, e);
        }
        reject(e);
      }
    });
  };
};

function _invokeCallback(callback, err, result) {
  // execute on next tick to prevent "unhandled rejected promise"
  // and simulate what would have happened in a promiseless API
  api.nextTick(() => callback(err, result));
}

/**
 * Encodes input according to the "Base64url Encoding" format as specified
 * in JSON Web Signature (JWS) RFC7517. A URL safe character set is used and
 * trailing '=', line breaks, whitespace, and other characters are omitted.
 *
 * @param input the data to encode.
 * @param options
 *          forge: forge library.
 *
 * @return the encoded value.
 */
api.encodeBase64Url = (input, {forge}) => {
  const enc = forge.util.encode64(input);
  return enc
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
 * Decodes input according to the "Base64url Encoding" format as specified
 * in JSON Web Signature (JWS) RFC7517. A URL safe character set is used and
 * trailing '=', line breaks, whitespace, and other characters are omitted.
 *
 * @param input the data to decode.
 * @param options
 *          forge: forge library.
 *
 * @return the decoded value.
 */
api.decodeBase64Url = (input, {forge}) => {
  let normalInput = input
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const mod4 = normalInput.length % 4;
  if(mod4 === 0) {
    // pass
  } else if(mod4 === 2) {
    normalInput = normalInput + '==';
  } else if(mod4 === 3) {
    normalInput = normalInput + '=';
  } else {
    throw new Error('Illegal base64 string.');
  }
  return forge.util.decode64(normalInput);
};

// method-char = %x61-7A / DIGIT
const methodChar = '[a-z0-9]';

// method-specific-id = *idchar *( ":" *idchar )
// idchar = ALPHA / DIGIT / "." / "-" / "_"
const idChar = '[\\w\\.\\-:]';

// This is used to both validate the format of a DID (we test for case later)
// and to get the component parts of the DID for later verification.
const DIDRegex = new RegExp(`^(?<did>did):(?<methodName>${methodChar}+)` +
  `:(?<methodSpecificId>${idChar}*)` +
  `(?<extra>(;${idChar}+=${idChar}*)*([\?#\/]*.*)*)*$`, 'i');

// Seperates the params and uri variables
// captured in the extra group in DIDRegex.
const paramRegex = new RegExp(
  `(?<param>(;${idChar}+=${idChar}*)*)(?<uri>[\?#\/]*.*)*`);
/**
 * Validates the format of a did id string.
 *
 * @param {String} did - A decentralized identifier.
 *
 *
 * @returns {Boolean} Is the did format correct?
 */
api.validateDidFormat = (did) => {
  return DIDRegex.test(did);
};

/**
 * Gets the did, methodName, and methodSpecificId, and extras from a did string.
 *
 * @param {String} did - A decentralized identifier.
 *
 * @returns {Object} The result of the exec.
 */
api.getGroups = (did) => {
  return DIDRegex.exec(did) || {};
};

function isLowercase(value) {
  const notLowerCase = value === value.toLowerCase();
  if(!notLowerCase) {
    throw new Error(`Expected ${value} to be all lowercase`);
  }
  return value;
}

/**
 * Validates a DID string.
 *
 * @param {String} did - A decentralized identifier.
 *
 * @throws Throws if the did is invalid.
 *
 * @returns {String} The did.
 */
api.validateIdentifier = str => {
  const validFormat = api.validateDidFormat(str);
  const invalidFormat = new Error('Invalid DID format. Expected your did ' +
      'to be did:method-name:method-specific-id');
  if(!validFormat) {
    throw invalidFormat;
  }
  const {groups} = api.getGroups(str);
  const {did, methodName, extra} = groups;
  isLowercase(did);
  isLowercase(methodName);
  if(methodName.length <= 0) {
    throw new Error('Expected method name to be at least one character');
  }
  // returns null if no extras
  const extras = paramRegex.exec(extra);
  if(extras) {
    const {groups: extraGroups} = extras;
    if(extraGroups) {
      const {param = '', uri = ''} = extraGroups;
      // remove empty strings
      const params = param.split(';')
        .filter(Boolean)
        .map(p => p.split('='));
      params.forEach(([key]) => {
        if(key.search(':') >= 0) {
          const [method, param] = key.split(':');
          if(method.trim() !== methodName) {
            throw new Error(
              'Invalid method specific parameter. ' +
              `Expected ${methodName}:${param} recieved ${key}`);
          }
        }
      });
      // this should error if any part
      // of the query, fragment, or path is invalid
      url.parse(uri, true);
    }
  }
  return str;
};

// ensures object is not an array, null, or an object.
// used for terms that can only have a single value.
function singleValue(value) {
  return typeof(value) !== typeof({});
}

function assertSingleValue(publicKey, property) {
  const value = publicKey[property];
  if(!value) {
    throw new Error(`Expected keyType to have a/an ${property}`);
  }
  if(!singleValue(value)) {
    throw new Error(`Expected keyType ${property} to be a` +
        ` single value got an object or array.`);
  }
}

/**
 * Loops through an object counting how many
 * times a key occurs in an object.
 *
 * @param {Object} doc - A DID document.
 * @param {string} term - The property to count.
 *
 * @return {number} How many times the term occurs in the document.
 */
function countKey(doc, term) {
  if(typeof(doc) === typeof('string')) {
    return 0;
  }
  if(typeof(doc) === typeof(1)) {
    return 0;
  }
  let count = 0;
  for(const key in doc) {
    if(key === term) {
      count++;
    }
    const isContext = key === '@context';
    if(!isContext) {
      const value = doc[key];
      // if the value is an object or a list recur
      if(typeof(value) === typeof({}) && value) {
        count += countKey(value, term);
      }
    }
  }
  return count;
}
api.countKey = countKey;

/**
 * Validates a DID Document.
 *
 * @param {Object} doc - A did Document.
 *
 * @throws Throws if the document is invalid.
 *
 * @returns {Object} The document.
 */
api.validateDocument = async(doc, contexts) => {
  if(!doc) {
    throw new Error('validate --document requires a document is passed in.');
  }
  if(!doc['@context']) {
    throw new Error('DID Documents require an @context property');
  }
  const context = doc['@context'];
  const firstURI = Array.isArray(context) ? context[0] : context;
  const latestDIDContext = 'https://www.w3.org/2019/did/v1';
  const isDIDContext = firstURI === latestDIDContext;
  if(!isDIDContext) {
    throw new Error('The first uri in a @context ' +
      ` must be ${latestDIDContext}` +
      ' @context must be an ordered set');
  }
  const id = doc.id;
  assertSingleValue(doc, 'id');
  if(typeof(id) !== typeof('string')) {
    throw new Error(`Expected id to be a string got ${typeof(id)} ${id}`);
  }
  api.validateIdentifier(id.trim());
  const contextCount = api.countKey(doc, '@context');
  if(contextCount > 1) {
    throw new Error('DID Documents may only have one top-level ' +
      `context found ${contextCount} @context properties`);
  }
  // publicKey is optional but if there should be checked.
  if(doc.publicKey) {
    if(!Array.isArray(doc.publicKey)) {
      throw new Error(
        `publicKey must be an array not ${typeof(doc.publicKey)}`);
    }
    const ids = [];
    doc.publicKey.forEach(value => {
      assertSingleValue(value, 'id');
      assertSingleValue(value, 'type');
      const id = value.id;
      if(!value.controller) {
        throw new Error(`Expected key ${id} to have a controller`);
      }
      if(ids.includes(id)) {
        throw new Error(`publicKey had a duplicate id ${id}`);
      }
      ids.push(id);
    });
  }
  // authentication is optional, but if there should be checked.
  if(doc.authentication) {
    if(!Array.isArray(doc.authentication)) {
      throw new Error(
        `authentication must be an array not ${typeof(doc.publicKey)}`);
    }
    doc.authentication.forEach(value => {
      if(!value) {
        throw new Error('An authentication property must be a ' +
          `string or an object recieved ${value}`);
      }
      const isString = typeof(value) === typeof('string');
      const isObject = typeof(value) === typeof({}) && !Array.isArray(value);
      const validType = isString || isObject;
      if(!validType) {
        throw new Error('An authentication property must be a ' +
          `string or an object recieved ${value}`);
      }
    });
  }
  // expanded format should ensure that no terms overwrite the did base context
  // here we replace the document's contexts with the test data passed in.
  if(contexts.length) {
    doc['@context'] = contexts;
  }
  await expand(doc);
};
