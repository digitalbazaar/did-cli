/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {Ed25519VerificationKey2020} from
  '@digitalbazaar/ed25519-verification-key-2020';
import {generateSecretKeySeed, decodeSecretKeySeed} from 'bnid';

/**
 * Generates a key pair. If no seed is given, a random one is generated.
 *
 * @param {object} options - Options hashmap.
 * @param {string} options.secretKeySeed - 32 byte random seed value, multihash
 *   identified, and multibase-encoded.
 *
 * @returns {Promise<{keyPair: object, secretKeySeed: string}>} - Resolves
 *   with a key pair, and optionally a text-encoded secret seed (if none was
 *   provided).
 */
export async function create({secretKeySeed}) {
  let keyPair;

  if(!secretKeySeed) {
    secretKeySeed = await generateSecretKeySeed();
  }

  try {
    const seedBytes = decodeSecretKeySeed({secretKeySeed});
    keyPair = await Ed25519VerificationKey2020.generate({seed: seedBytes});
  } catch(e) {
    if(e.message === 'Decoded identifier size too large.') {
      console.log('Secret key seed must be a 32 byte random value, ' +
        'multihash identified and multibase encoded.');
    } else {
      console.error(e);
    }
    process.exit(1);
  }
  return {
    keyPair: keyPair.export({
      publicKey: true, privateKey: true, includeContext: true
    }),
    secretKeySeed
  };
}
