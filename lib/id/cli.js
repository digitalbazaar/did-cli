/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import * as id from '.';
import {_displayOutput} from '../displayOutput.js';
import {_setupFormatOption, _initSecretKeySeed} from '../options.js';

function idCommand(yargs) {
  return yargs.command('id <action>', 'Generate and manage DIDs.', {
    handler: _handler,
    builder: _yargs => {
      _setupFormatOption(yargs);
      return _yargs
        .positional('action', {
          describe: 'Action to perform.',
          choices: ['create'],
          default: 'create'
        })
        .option('method', {
          type: 'string',
          describe: `DID method identifier (e.g. 'key' for did:key).`,
          default: 'key'
        });
    }
  });
}

async function _handler(args) {
  const secretKeySeed = await _initSecretKeySeed();
  switch(args.action) {
    case 'create':
      const res = await id.create({secretKeySeed, ...args});
      _displayOutput(res, args);
      break;
    default:
      console.log(`Error: '${args._} ${args.action}' command not supported.`);
      process.exit(1);
  }
}
export {idCommand as command};
