/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import * as anchor from '.';
import {_displayOutput} from '../displayOutput.js';
import {
  _setupCanonicalizeOption,
  _setupFileOption,
  _setupFormatOption,
  _setupUrlOption
} from '../options.js';
import {getResource} from '../getResource.js';

function anchorCommand(yargs) {
  return yargs.command('anchor <action>',
    'Create and verify anchoredResource objects.', {
      handler: _handler,
      builder: _yargs => {
        _setupCanonicalizeOption(yargs);
        _setupFileOption(yargs);
        _setupFormatOption(yargs);
        _setupUrlOption(yargs);
        return _yargs
          .positional('action', {
            describe: 'Action to perform.',
            choices: ['create', 'verify'],
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
  let result;
  const {file, url} = args;
  const resource = await getResource({file, url});
  switch(args.action) {
    case 'create':
      result = await anchor.create({resource, ...args});
      _displayOutput(result, args);
      break;
    case 'verify':
      result = await anchor.verify({resource, ...args});
      _displayOutput(result, args);
      break;
    default:
      console.log(`Error: '${args._} ${args.action}' command not supported.`);
      process.exit(1);
  }
}
export {anchorCommand as command};
