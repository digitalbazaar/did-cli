/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {encode as base58Encode} from 'base58-universal';
import {CachedResolver} from '@digitalbazaar/did-io';
import * as didKey from '@digitalbazaar/did-method-key';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {ZcapClient} from '@digitalbazaar/ezcap';
import {_parseCapability} from '../options.js';

const resolver = new CachedResolver();
resolver.use(didKey.driver());

const ROOT_ZCAP_TEMPLATE = {
  '@context': [
    'https://w3id.org/zcap/v1',
    'https://w3id.org/security/suites/ed25519-2020/v1'
  ],
  id: 'urn:zcap:root:...',
  controller: 'did:...',
  invocationTarget: 'https://example.com/api/endpoint'
};

/**
 * Delegates an Authorization Capability to a target delegate.
 *
 * @param {object} options - The options to use.
 * @param {{encoded: string, bytes: Uint8Array}} options.zcapControllerKeySeed -
 *   32 byte random seed value, multihash identified, and multibase-encoded.
 * @param {string} options.controller - Capability controller DID.
 * @param {string} [options.url] - URL to invoke the Authorization Capability
 *   against, aka the `invocationTarget`.
 * @param {string} [options.method='key'] - DID method id.
 *
 * @returns {Promise<object>} - A promise that resolves to an object with
 *   a root capability and its base58-encoded version.
 */
export async function create({
  zcapControllerKeySeed, method, url, controller
}) {
  const {didDocument} = await resolver.generate({
    method, seed: zcapControllerKeySeed.bytes
  });

  if(didDocument.id !== controller) {
    throw new Error('The controller DID does not match the generated DID.');
  }

  const rootCapability = {
    ...ROOT_ZCAP_TEMPLATE,
    id: `urn:zcap:root:${encodeURIComponent(url)}`,
    controller: didDocument.id,
    invocationTarget: url
  };

  const encoded = base58Encode(
    new TextEncoder().encode(JSON.stringify(rootCapability)));

  return {rootCapability, encoded: `z${encoded}`};
}
