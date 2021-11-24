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
            choices: ['create', 'delegate'],
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
          .option('capability', {
            type: 'string',
            describe: 'The parent capability to delegate. Either url or ' +
              'capability must be specified.'
          })
          .option('delegatee', {
            type: 'string',
            describe: 'The URL identifying the entity to delegate to.',
            demandOption: true
          })
          .option('invocationTarget', {
            type: 'string',
            describe: 'Optional invocation target to use when narrowing a ' +
              `capability's existing invocationTarget. Default is to use "url".`
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
      _displayOutput(await zcap.create({zcapControllerKeySeed, ...args}), args);
      break;
    case 'delegate':
      _displayOutput(await zcap.delegate({zcapControllerKeySeed, ...args}));
      break;
    default:
      console.log(`Error: '${args._} ${args.action}' command not supported.`);
      process.exit(1);
  }
}
export {zcapCommand as command};
