/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {CachedResolver} from '@digitalbazaar/did-io';
import * as didKey from '@digitalbazaar/did-method-key';
import {Ed25519VerificationKey2020}
  from '@digitalbazaar/ed25519-verification-key-2020';
import {X25519KeyAgreementKey2020}
  from '@digitalbazaar/x25519-key-agreement-key-2020';
import * as didWeb from '@interop/did-web-resolver';
import {CryptoLD} from 'crypto-ld';

import {serialize as serializeKey} from '../key';
import {_getStore} from '../storage';

const cryptoLd = new CryptoLD();
cryptoLd.use(Ed25519VerificationKey2020);
cryptoLd.use(X25519KeyAgreementKey2020);
const didWebDriver = didWeb.driver({cryptoLd});

const resolver = new CachedResolver();
resolver.use(didKey.driver());
resolver.use(didWebDriver);

/**
 * Generates a key pair. If no seed is given, a random one is generated.
 *
 * @param {object} options - Options hashmap.
 * @param {{encoded: string, bytes: Uint8Array}} options.secretKeySeed -
 *   32 byte random seed value, multihash identified, and multibase-encoded.
 * @param {string} options.method - DID Method.
 *
 * @returns {Promise<{id: string, keyPair: object, secretKeySeed: string,
 *   keyPairs: Map}>} - Resolves with the DID Document results, and optionally
 *   a text-encoded secret seed (if none was provided).
 */
export async function create({secretKeySeed, method, url} = {}) {
  const {didDocument, keyPairs} = await resolver.generate({
    method, seed: secretKeySeed.bytes, url
  });

  const result = {
    id: didDocument.id,
    didDocument,
    keyPairs
  };

  if(method === 'key') {
    result.secretKeySeed = secretKeySeed.encoded;
  }

  return result;
}

export async function saveIfRequested({
  id, secretKeySeed, didDocument, keyPairs, args
}) {
  if(!args.save) {
    return;
  }
  const {storageId, ...serialized} = await serialize({
    ...args, id, secretKeySeed, didDocument, keyPairs
  });
  const didStore = _getStore({collection: 'dids'});
  await didStore.put(storageId, serialized);

  const keyStore = _getStore({collection: 'keys'});
  for(const keyPair of keyPairs.values()) {
    const description = `${keyPair.type} key pair generated for ` +
      `a DID Document on ${(new Date()).toISOString()}.`;

    const {storageId: keyStorageId, ...serializedKey} =
      await serializeKey({keyPair, description});
    await keyStore.put(keyStorageId, serializedKey);
  }
}

export async function serialize({
  id, secretKeySeed, didDocument, description
}) {
  const date = (new Date()).toISOString();

  description = description || `did:key DID generated on ${date}.`;
  const events = [
    {type: 'create', date, note: 'Generated.'}
  ];
  return {
    storageId: `${date}-${id}`.replace(':', '_'),
    id,
    didDocument,
    description,
    secretKeySeed,
    events
  };
}
