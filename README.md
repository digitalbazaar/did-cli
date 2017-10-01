# did-client

A command-line client for managing Decentralized Identifiers.

## Quickstart

The current client supports the creation of Testnet DIDs on the Veres One
ledger as well as the retrieval of those DIDs from the Testnet. You can
try the tool out by doing the following commands on a system that has
node.js and a C++ compiler installed:

    npm install did-client
    cd node_modules/did-client
    ./did create
    
To retrieve the freshly created DID:

    ./did get <DID>

## Requirements

* Linux
  * g++ to build native Equihash binaries
* Mac OS X
  * X Code 9 to build native Equihash binaries
* Node.js >= 6.x
* npm >= 3.x

## Developing

To download the source and install the client:

    git clone https://github.com/digitalbazaar/did-client.git
    cd did-client
    npm install
    ./did create

Once you have created a DID, you can retrieve it from the ledger doing this
command:

    ./did get <DID>

## Roadmap

There are plans to support the following other commands and features:

  * Adding, rotating, and removing authentication credentials
  * Adding and removing authorization capability descriptions
  * Adding and removing service descriptions
  * Checking the validity of a DID (deep blockchain check)
