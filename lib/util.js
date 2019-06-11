/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

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
const methodChar = '[a-z09]';

// method-specific-id = *idchar *( ":" *idchar )
// idchar = ALPHA / DIGIT / "." / "-" / "_"
const idChar = '[\\w\\.\\-:]';

const DIDRegex = new RegExp(`^(?<did>did):(?<methodName>${methodChar}+)` +
  `:(?<methodSpecificId>${idChar}*)(?<extra>[;\\?#\/]*.*)$`, 'i');

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
  if(!groups) {
    throw invalidFormat;
  }
  const {did, methodName} = groups;
  isLowercase(did);
  isLowercase(methodName);
  if(methodName.length <= 0) {
    throw new Error('Expected method name to be at least one character');
  }
  return str;
};

function singleValue(value) {
  return typeof(value) !== typeof({});
}

function assertSingleValue(publicKey, property) {
  const value = publicKey[property];
  if(!value) {
    throw new Error(`Expected keyType to have an ${property}`);
  }
  if(!singleValue(value)) {
    throw new Error(`Expected keyType ${property} to be a` +
        ` single value got an object or array.`);
  }
}

/**
 * Validates a DID Document.
 *
 * @param {Object} doc - A did Document.
 *
 * @throws Throws if the document is invalid.
 *
 * @returns {Object} The document.
 */
api.validateDocument = doc => {
  if(!doc) {
    throw new Error('validate --document requires a document is passed in.');
  }
  if(!doc['@context']) {
    throw new Error('DID Documents require an @context property');
  }
  const context = doc['@context'];
  if(!Array.isArray(context)) {
    throw new Error('DId Documents @context must be arrays');
  }
  const firstURI = context[0] === 'https://www.w3.org/2019/did/v1';
  if(!firstURI) {
    throw new Error('The first uri in a @context ' +
      ' must be https://www.w3.org/2019/did/v1' +
      ' @context must be an ordered set');
  }
  const id = doc.id;
  if(!id) {
    throw new Error('DID Documents must have an id property');
  }
  if(Array.isArray(id)) {
    throw new Error('DID Documents must have one subject aka id');
  }
  api.validateIdentifier(id.trim());
  if(doc.publicKey) {
    if(!Array.isArray(doc.publicKey)) {
      throw new Error(
        `publicKey must be an array not ${typeof(doc.publicKey)}`);
    }
    doc.publicKey.forEach(value => {
      assertSingleValue(value, 'id');
      assertSingleValue(value, 'type');
      if(!value.controller) {
        throw new Error(`Expected key ${id} to have a controller`);
      }
    });
  }
};
