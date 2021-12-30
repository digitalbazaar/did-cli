/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {Ed25519VerificationKey2020} from
  '@digitalbazaar/ed25519-verification-key-2020';
import {X25519KeyAgreementKey2020} from
  '@digitalbazaar/x25519-key-agreement-key-2020';
import {CryptoLD} from 'crypto-ld';
import {_getStore} from '../storage';

const cryptoLd = new CryptoLD();

cryptoLd.use(Ed25519VerificationKey2020);
cryptoLd.use(X25519KeyAgreementKey2020);

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

export async function saveIfRequested({secretKeySeed, keyPair, args}) {
  if(!args.save) {
    return;
  }
  const {storageId, ...serialized} =
    await serialize({...args, secretKeySeed, keyPair});
  const store = _getStore({collection: 'keys'});
  await store.put(storageId, serialized);
}

export async function serialize({secretKeySeed, keyPair, description}) {
  const pair = await cryptoLd.from(keyPair);
  const date = (new Date()).toISOString();
  const id = pair.id || pair.fingerprint();
  description = description || `ed25519 key pair generated on ${date}.`;
  const events = [
    {type: 'create', date, note: 'Generate from seed.'}
  ];
  return {
    storageId: `${date}-ed25519-${id}`.replace(':', '_'),
    description,
    secretKeySeed,
    keyPair,
    events
  };
}
