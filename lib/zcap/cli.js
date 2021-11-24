/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import assert from 'assert-plus';
import * as zcap from '.';
import {_displayOutput} from '../displayOutput.js';
import {_setupFormatOption, _decodeSecretKeySeed} from '../options.js';

function zcapCommand(yargs) {
  return yargs.command('zcap <action>',
    'Manage zCaps (Authorization Capabilities).',
    {
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
            describe: `DID method for the controller DID to be generated.`,
            default: 'key'
          })
          .option('controller', {
            type: 'string',
            describe: `The DID of the zCap controller.`,
            // demandOption: true
          })
          .option('allow', {
            type: 'array',
            describe: 'List of allowed actions or string specifying allowed ' +
              'delegated action.',
            choices: ['read', 'write'],
            default: ['read']
          })
          .option('url', {
            type: 'string',
            describe: 'The URL to invoke the Authorization Capability ' +
            'against, aka the invocationTarget.'
          })
          .option('ttl', {
            type: 'string',
            describe: `Optional time to live value for the capability.`,
            default: '1y'
          });
      }
    });
}

async function _handler(args) {
  assert.string(
    process.env.ZCAP_CONTROLLER_KEY_SEED, 'ZCAP_CONTROLLER_KEY_SEED');
  const zcapControllerKeySeed = _decodeSecretKeySeed({
    secretKeySeed: process.env.ZCAP_CONTROLLER_KEY_SEED
  });

  switch(args.action) {
    case 'create':
      const res = await zcap.create({zcapControllerKeySeed, ...args});
      _displayOutput(res, args);
      break;
    default:
      console.log(`Error: '${args._} ${args.action}' command not supported.`);
      process.exit(1);
  }
}
export {zcapCommand as command};
