/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {encode as base58Encode} from 'base58-universal';
import {CachedResolver} from '@digitalbazaar/did-io';
import * as didKey from '@digitalbazaar/did-method-key';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';
import {ZcapClient} from '@digitalbazaar/ezcap';
import {_parseCapability, _parseTtl} from '../options.js';

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
 * @param {string} options.delegatee - URL identifying the entity to
 *   delegate to.
 * @param {string} [options.capability] - Optional capability to delegate.
 * @param {string} [options.invocationTarget] - Optional target, used for
 *   attenuating (restricting) the parent zcap's target.
 * @param {string} [options.method='key'] - DID method id.
 *
 * @returns {Promise<object>} - A promise that resolves to an object with
 *   a root capability and its base58-encoded version.
 */
export async function delegate({
  zcapControllerKeySeed, method, allow, url, controller, delegatee,
  capability, invocationTarget, ttl
}) {
  if(!(url || capability)) {
    throw new TypeError('Either a url or a capability is required.');
  }
  const {didDocument, methodFor} = await resolver.generate({
    method, seed: zcapControllerKeySeed.bytes
  });

  if(didDocument.id !== controller) {
    throw new Error('The controller DID does not match the generated DID.');
  }
  const capabilityDelegationKey = methodFor({purpose: 'capabilityDelegation'});
  const zcapClient = new ZcapClient({
    delegationSigner: capabilityDelegationKey.signer(),
    SuiteClass: Ed25519Signature2020
  });

  const expires = _parseTtl({ttl});

  if(capability) {
    capability = _parseCapability({capability});
  }

  try {
    const delegatedCapability = await zcapClient.delegate({
      url, capability, targetDelegate: delegatee, allowedActions: allow,
      invocationTarget, expires
    });

    const encoded = base58Encode(
      new TextEncoder().encode(JSON.stringify(delegatedCapability)));

    return {delegatedCapability, encoded: `z${encoded}`};
  } catch(e) {
    console.log(e);
    process.exit(1);
  }
}
