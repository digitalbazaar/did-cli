/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import * as id from '.';
import {_displayOutput} from '../displayOutput.js';
import {
  _setupFormatOption,
  _initSecretKeySeed,
  _setupDescriptionOption,
  _setupSaveOption,
  _setupUrlOption
} from '../options.js';

function idCommand(yargs) {
  return yargs.command('id <action>', 'Generate and manage DIDs.', {
    handler: _handler,
    builder: _yargs => {
      _setupFormatOption(yargs);
      _setupSaveOption(yargs);
      _setupDescriptionOption(yargs);
      _setupUrlOption(yargs);
      return _yargs
        .positional('action', {
          describe: 'Action to perform.',
          choices: ['create', 'generate'],
          default: 'create'
        })
        .option('method', {
          type: 'string',
          describe: `DID method identifier (e.g. 'key' for did:key).`,
          choices: ['key', 'web'],
          default: 'key'
        });
    }
  });
}

async function _handler(args) {
  const secretKeySeed = await _initSecretKeySeed();
  switch(args.action) {
    case 'create':
    case 'generate':
      const {keyPairs, ...result} = await id.create({secretKeySeed, ...args});
      _displayOutput(result, args);
      await id.saveIfRequested({...result, keyPairs, args});
      break;
    default:
      console.log(`Error: '${args._} ${args.action}' command not supported.`);
      process.exit(1);
  }
}
export {idCommand as command};
