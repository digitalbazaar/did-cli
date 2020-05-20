/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const drivers = require('./drivers');
const storage = require('./storage');

module.exports = {
  ...drivers,
  ...storage
};
