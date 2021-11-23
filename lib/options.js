/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {decodeSecretKeySeed, generateSecretKeySeed} from 'bnid';

export function _setupFormatOption(yargs) {
  return yargs
    .option('format', {
      type: 'string',
      describe: 'Output format',
      choices: [
        'json-compact',
        'json'
      ],
      default: 'json',
      alias: 'f'
    });
}

/**
 * Initializes a secret key seed Uint8Array buffer, either from an env
 * variable, or generates a new one (if none was passed in).
 *
 * @returns {Promise<{encoded: string, bytes: Uint8Array}>} Secret key seed.
 */
export async function _initSecretKeySeed() {
  const secretKeySeed = process.env.SECRET_KEY_SEED ||
    await generateSecretKeySeed();

  let secretKeySeedBytes;
  try {
    secretKeySeedBytes = decodeSecretKeySeed({secretKeySeed});
  } catch(e) {
    const error = new TypeError(
      'Secret key seed must be a 32 byte random ' +
      'value multihash identified and multibase encoded.');
    error.cause = e;
    console.error(error);
    process.exit(1);
  }

  return {encoded: secretKeySeed, bytes: secretKeySeedBytes};
}
