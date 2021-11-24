/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {CachedResolver} from '@digitalbazaar/did-io';
import * as didKey from '@digitalbazaar/did-method-key';

const resolver = new CachedResolver();
resolver.use(didKey.driver());

/**
 * Generates a key pair. If no seed is given, a random one is generated.
 *
 * @param {object} options - Options hashmap.
 * @param {{encoded: string, bytes: Uint8Array}} options.secretKeySeed -
 *   32 byte random seed value, multihash identified, and multibase-encoded.
 * @param {string} options.method - DID Method.
 *
 * @returns {Promise<{keyPair: object, secretKeySeed: string}>} - Resolves
 *   with a key pair, and optionally a text-encoded secret seed (if none was
 *   provided).
 */
export async function create({secretKeySeed, method} = {}) {
  const {didDocument} = await resolver.generate({
    method, seed: secretKeySeed.bytes
  });

  return {
    id: didDocument.id,
    secretKeySeed: secretKeySeed.encoded,
    didDocument
  };
}
