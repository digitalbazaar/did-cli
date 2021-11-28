/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {canonicalize as jcsCanonicalize} from 'json-canonicalize';
import {base58btc} from 'multiformats/bases/base58';
import {sha256} from 'multiformats/hashes/sha2';

/**
 * @param {object} options - Options hashmap.
 * @param {string} [options.url] - Optional URL of resource. Used for 'id' if
 *   none is found in resource parsed contents.
 * @param {string} [options.canonicalize='jcs'] - For JSON content types,
 *   canonicalization algorithm performed before hashing.
 * @param {object} options.resource - Result of getResource().
 * One of:
 * @param {object} [options.resource.parsed] - Parsed JSON object.
 * @param {Uint8Array} [options.resource.raw] - Raw resource contents bytes.
 */
export async function create({
  url, canonicalize, resource: {raw, parsed}
} = {}) {
  let contents;
  let id;
  if(parsed) {
    switch(canonicalize) {
      case 'jcs':
        contents = new Uint8Array(JSON.stringify(jcsCanonicalize({parsed})));
        id = parsed.id || url;
        break;
      default:
        throw new TypeError(
          `Unsupported canonicalization algorithm "${canonicalize}".`);
    }
  } else {
    contents = raw;
    id = url;
  }

  const digest = await sha256.digest(contents);
  console.log(digest);
  const contentHash = await base58btc.encode(digest.bytes);

  const anchoredResource = {};
  if(id) {
    anchoredResource.id = id;
  }
  anchoredResource.contentHash = {digestValue: contentHash};
  if(parsed) {
    anchoredResource.contentHash.canonicalizationAlgorithm = canonicalize;
  }

  return {anchoredResource};
}
