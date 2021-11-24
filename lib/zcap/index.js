/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {encode as base58Encode} from 'base58-universal';
import {CachedResolver} from '@digitalbazaar/did-io';
import * as didKey from '@digitalbazaar/did-method-key';
import dayjs from 'dayjs';

const resolver = new CachedResolver();
resolver.use(didKey.driver());

const ROOT_ZCAP_TEMPLATE = {
  '@context': [
    'https://w3id.org/zcap/v1',
    'https://w3id.org/security/suites/ed25519-2020/v1'
  ],
  id: 'urn:zcap:root:...',
  controller: 'did:...',
  invocationTarget: 'https://example.com/api/endpoint',
  expires: '2022-11-24T01:01:07Z',
  allowedAction: []
};

/**
 * Delegates an Authorization Capability to a target delegate.
 *
 * @param {object} options - The options to use.
 * @param {{encoded: string, bytes: Uint8Array}} options.zcapControllerKeySeed -
 *   32 byte random seed value, multihash identified, and multibase-encoded.
 * @param {string} options.controller - Capability controller DID.
 * @param {Array<string>} [options.allow] - Optional list of allowed
 *   actions or string specifying allowed delegated action. Default: ['read'] -
 *   delegate all actions.
 * @param {string} [options.url] - URL to invoke the Authorization Capability
 *   against, aka the `invocationTarget`.
 * @param {string} [options.ttl] - Optional time to live value for the
 *   delegation.
 * @param {string} [options.method='key'] - DID method id.
 *
 * @returns {Promise<object>} - A promise that resolves to an object with
 *   a root capability and its base58-encoded version.
 */
export async function create({
  zcapControllerKeySeed, method, allow, url, controller, ttl
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
    allowedAction: allow,
    invocationTarget: url,
    expires: _parseTtl({ttl})
  };

  const encoded = base58Encode(
    new TextEncoder().encode(JSON.stringify(rootCapability)));

  return {rootCapability, encoded: `z${encoded}`};
}

/**
 * Parses a time-to-live value (in dayjs format), and converts it to a
 * serialized expiration timestamp in XML DateTime format.
 *
 * @param {object} options - Options hashmap.
 * @param {string} [options.ttl='1y'] - Time-to-live, in dayjs format.
 *
 * @returns {string} Serialized expiration timestamp.
 */
function _parseTtl({ttl}) {
  // split ttl into numbers and letters
  ttl = ttl.match(/(\d+)(d|w|M|Q|y|h|ms|m|s)/);

  if(!ttl) {
    throw new Error('Invalid ttl format.');
  }
  const numberString = ttl[1];
  const unit = ttl[2];
  // Remove milliseconds and add 'Z' to indicate that the time zone is UTC
  return dayjs().add(numberString, unit).toISOString()
    .slice(0, -5) + 'Z';
}
