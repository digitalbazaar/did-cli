/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */

import {FlexDocStore} from 'flex-docstore';
import os from 'os';
import path from 'path';

export function _getStore({
  collection, dir, extension = '.json', ...options
}) {
  dir = dir || path.join(os.homedir(), '.wallet', collection);
  return FlexDocStore.using('files', {dir, extension, ...options});
}
