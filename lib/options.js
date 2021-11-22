/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
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
