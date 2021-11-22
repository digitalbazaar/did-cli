/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import * as key from '.';
import {_displayOutput} from '../displayOutput.js';
import {_setupFormatOption} from '../options.js';

function keyCommand(yargs) {
  return yargs.command('key <action>', 'Generate and manage key pairs.', {
    handler: _handler,
    builder: _yargs => {
      _setupFormatOption(yargs);
      return _yargs
        .positional('action', {
          describe: 'Action to perform.',
          choices: ['create'],
          default: 'create'
        });
    }
  });
}

async function _handler(args) {
  const secretKeySeed = process.env.SECRET_KEY_SEED;
  switch(args.action) {
    case 'create':
      const res = await key.create({secretKeySeed, ...args});
      _displayOutput(res, args);
      break;
    default:
      console.log(`Error: '${args._} ${args.action}' command not supported.`);
      process.exit(1);
  }
}
export {keyCommand as command};
