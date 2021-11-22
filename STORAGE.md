## Setting Up Storage

To work with DIDs, you'll need storage for keys, local DID docs, and
notes.

**By default, everything is stored in `~/.dids/<method>/`.**

DIDs are essentially repositories of public keys on various networks / ledgers.
Any non-trivial operations that involve them, such as registering, updating,
authenticating and so on, necessarily involve working with corresponding private
keys.

To aid with experimentation and development of DID-related prototypes, `did-io`
uses a simple filesystem based JSON blob storage system, to store private keys,
local copies of DID documents, and DID metadata on one's local machine.

Keys from DID Documents (as well as related metadata) you control will be stored
in the `~/.dids/<method>/` folder by default, and will be organized by
DID.

For example for a DID of "did:method:abcd", the following files would be
potentially created:

- `~/.dids/method/did:method:abcd.json`
- `~/.dids/method/did:method:abcd.keys.json`
- `~/.dids/method/did:method:abcd.meta.json`

You can override the storage mechanism for each ledger method (to store JSON
files in a different directory, or to use an in-memory `MockStore` for unit
testing).
