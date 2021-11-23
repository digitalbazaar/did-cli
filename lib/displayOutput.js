/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */

export function _displayOutput(output, options) {
  let fmt;
  if(options) {
    fmt = options.format;
  } else {
    fmt = 'json';
  }
  if(fmt === 'json') {
    const json = {...output};
    console.log(JSON.stringify(json, null, 2));
  } else if(fmt === 'json-compact') {
    const json = {...output};
    console.log(JSON.stringify(json));
  } else {
    console.log(`Unrecognized output format: "${fmt}".`);
  }
}
