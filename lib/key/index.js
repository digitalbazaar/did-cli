/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {Ed25519VerificationKey2020} from
  '@digitalbazaar/ed25519-verification-key-2020';

/**
 * Generates a key pair. If no seed is given, a random one is generated.
 *
 * @param {object} options - Options hashmap.
 * @param {{encoded: string, bytes: Uint8Array}} options.secretKeySeed -
 *   32 byte random seed value, multihash identified, and multibase-encoded.
 *
 * @returns {Promise<{keyPair: object, secretKeySeed: string}>} - Resolves
 *   with a key pair, and optionally a text-encoded secret seed (if none was
 *   provided).
 */
export async function create({secretKeySeed}) {
  let keyPair;

  try {
    keyPair = await Ed25519VerificationKey2020.generate({
      seed: secretKeySeed.bytes
    });
  } catch(e) {
    console.log(e);
    process.exit(1);
  }
  return {
    secretKeySeed: secretKeySeed.encoded,
    keyPair: keyPair.export({
      publicKey: true, privateKey: true, includeContext: true
    })
  };
}
