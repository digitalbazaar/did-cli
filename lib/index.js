/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
if(require('semver').gte(process.version, '8.0.0')) {
  module.exports = require('./methods');
} else {
  module.exports = require('../dist/node6/lib/methods');
}
