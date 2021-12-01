/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {readFile} from 'fs/promises';
import getStdin from 'get-stdin';
import {httpClient} from '@digitalbazaar/http-client';
import mime from 'mime-types';

/**
 * Reads in the resource (used for content hashes, signing, etc).
 * If `--file` param is available, load from file.
 * Otherwise, if `--url` param is available, fetch it from that URL.
 * Lastly, try reading in from `stdin`.
 *
 * Throws an Error if no input is found.
 *
 * Warning: The entire resource is read into memory (typically for hashing or
 * verifying), so do not use with giant resources.
 *
 * @param {object} options - Options hashmap.
 * @param {string} [options.file] - Input file path.
 * @param {string} [options.url] - Resource URL.
 *
 * @returns {Promise<{contentType: string, parsed: object, raw: Uint8Array}>}
 *   Resolves with a resource containing a `contentType`, and either a parsed
 *   JSON object, or a raw byte array (for non-JSON resources).
 */
export async function getResource({file, url}) {
  let contentType;
  let contents;
  const resource = {};

  if(file) {
    ({contentType, contents} = await _resourceFromFile({file}));
  } else if(url) {
    ({contentType, contents} = await _resourceFromUrl({url}));
  } else {
    ({contentType, contents} = await _resourceFromStdin());
  }

  if(contentType.includes('json')) {
    try {
      resource.parsed = JSON.parse(contents);
    } catch(cause) {
      throw new TypeError('Error parsing JSON from input.', {cause});
    }
  } else {
    resource.raw = contents;
  }
  resource.contentType = contentType;

  return resource;
}

/**
 * Reads in and returns the contents of a file.
 *
 * @param {object} options - Options hashmap.
 * @param {string} options.file - Input file path.
 *
 * @returns {Promise<{contents: Uint8Array|string, contentType: string}>}
 *   - Resolves with the contents and contentsType tuple.
 */
async function _resourceFromFile({file}) {
  let contents;
  const contentType = mime.lookup(file);
  if(!contentType) {
    throw new TypeError(
      `Cannot determine content type from file extension for "${file}".`);
  }
  if(contentType.includes('json')) {
    contents = await readFile(file, 'utf8');
  } else {
    contents = new Uint8Array(await readFile(file));
  }
  return {contentType, contents};
}

async function _resourceFromUrl({url}) {
  let contentType;
  let contents;
  let response;
  try {
    response = await httpClient.get(url);
    contentType = response.headers.get('content-type');
  } catch(cause) {
    const {status} = cause;
    throw new Error(`Error fetching resource from url: ${status}.`, {cause});
  }
  if(contentType.includes('json')) {
    // To be parsed in getResource().
    contents = JSON.stringify(response.data);
  } else {
    contents = new Uint8Array(await response.arrayBuffer());
  }
  return {contentType, contents};
}

async function _resourceFromStdin() {
  // Assumed to be a JSON[-LD] string from stdin (other types not supported)
  const contents = await getStdin();
  return {contentType: 'application/json', contents};
}
