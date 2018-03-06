# did-client

A command-line client for managing Decentralized Identifiers.

 * [Quickstart](#quickstart)
 * [Installation](#installation)
 * [Usage](#usage)
   * [General](#general)
   * [Generate a DID](#generate-a-did)
   * [Register on a Ledger](#register-on-a-ledger)
   * [DID Information](#did-information)
   * [Notes](#notes)
   * [Key Management](#key-management)
 * [Examples](#examples)
 * [Roadmap](#roadmap)
 * [Support](#support)

## Quickstart

The current client supports the creation of Testnet DIDs on the Veres One
ledger as well as the retrieval of those DIDs from the Testnet. You can try the
tool out by doing the following commands on a system that has node.js and a C++
compiler installed:

    npm install did-client
    cd node_modules/did-client
    ./did generate -r

To retrieve the freshly generated DID:

    ./did get <DID>

## Installation

### Requirements

* Linux
  * g++ to build native Equihash binaries
* Mac OS X
  * X Code 9 to build native Equihash binaries
* Node.js >= 8.6.x
* npm >= 3.x

### Install

Install in a development directory:

    npm install did-client
    ./node\_modules/.bin/did ...

Install globally:

    npm install -g did-client
    did ...

Run from npx:

    npx did-client ...

### Developing

To download the source and install the client:

    git clone https://github.com/digitalbazaar/did-client.git
    cd did-client
    npm install
    ./did ...

## Usage

### General

The `did` command has many commands and options.  Help is available with the
`--help/-h` command line option:

    did -h
    did COMMAND -h

Commands can be more verbose with one ore more `--verbose/-v` options, or
quieted more than the default with `--quiet/-q`:

    did COMMAND -v ...
    did COMMAND -vv ...
    did COMMAND -q ...

Local DID data and a config file is stored in your `$HOME/.did/` directory.

Remote commands operate on a ledger.  Various ledgers may be available.  They
can be selected with the `--ledger/-l` option which defaults to `veres`.

    did COMMAND -l LEDGER ...

Remote ledger commands also have a "live", "test", or "dev" mode selected with
`--mode/-m` which defaults to `test`:

    did COMMAND -m MODE ...

The combination of ledger and mode options will select the default hostnames to
connect to.  Specific hostnames can be selected with `--hostname/-H`:

    did COMMAND -l example -m test -H host1.example.com ...

### Generate a DID

A DID is generated locally with the `generate` command:

    did generate

Other options:

* `--passphrase/-p PASSPHRASE`: set a key passphrase
* `--type/-t TYPE`: set key type (ex: `ed25519` or `rsa`)
* `--name NAME`: set a private name [note](#notes)
* `--description DESCRIPTION`: set a private description [note](#notes)
* `--no-notes`: don't add automatic "created" private [note](#notes)
* `--register/-r`: register on a ledger

### Register on a Ledger

By default `generate` will only store a DID locally.  If you want to also
immediately register it to the default Veres One testnet ledger:

    did generate -r

You can register local DIDs to a ledger with the `register` command:

    did register DID

Some ledgers may require DID authorization (this topic is outside of the scope
of this tool).  You can specify an authorization DID key with `--auth/-a`:

    did register DID -a AUTHDID

Some ledgers may require proof-of-work to accept a DID request.  Others may
allow "accelerators" to be used.  These are specified with `--accelerator/-A`
and require an authorizaion DID:

    did register DID -a AUTHDID -A ACCELERATORHOSTNAME

Other options:

* `--no-notes`: don't add automatic "ledger" private [note](#notes)

### DID Information

Local DIDs can be listed with the `list` command:

    did list

Information on a DID can be found with the `info` command:

    did info DID

The output format can be controlled with the `--format/-f` option:

* `found`: show FOUND / NOT FOUND status
* `human`: show basic details formatted for humans
* `json`: show data as JSON

    did info DID -f json

By default this command will return information from the ledger.  The location
of information can be selected with the `--location/-L` option:

* `any`: return DID if found locally, else check the ledger
* `local`: only return local DIDs
* `ledger`: only check the default ledger host (or many with `-H` options)
  (**default**)
* `both`: check both local *and* default ledger host (or many with `-H`
  options)
* `ledger-all`: check all known ledger hosts
* `all`: check local *and* all known ledger hosts

The `ledger-all` option and `all` options allow more insight into the state of
a distributed ledger.  They are useful with the `-f found` option.

### Notes

It can be useful to store **private** local notes about DIDs which are
otherwise somewhat opaque identifiers.  The `notes` command adds this ability
with simple key/value pairs.

All notes for all DIDs can be shown with:

    did notes

Notes for specific DID can be shown:

    did notes DID

Various notes operations are available:

* `--clear`: remove all notes
* `--add KEY VALUE`: append VALUE to an array for KEY
* `--remove`: remove VALUE from array for KEY
* `--get KEY`: get KEY value
* `--set KEY VALUE`: set single VALUE for KEY
* `--delete`: delete all values for KEY
* `--find KEY VALUE`: find DIDs with VALUE set for KEY

If a DID is not specified the commands will operate on *all* DIDs.  As this can
be dangerous, any operation with operates on many DIDs must use the `--all`
option.

    did notes --delete old-property --all

You can choose any KEY values you wish, although simple strings will be easiest
to use.  The `generate` and `register` commands have an "auto" feature to write
some notes.  The "name" note is useful to assign simple names to DIDs.  The
"ledger" note is useful to keep track of where DIDs have been sent.

    $ did notes did:example:test:1234 --set name shortname
    $ did notes did:example:test:1234 --get name
    did:example:test:1234 name
    $ did notes --find name shortname
    did:example:test:1234

    $ did notes did:example:test:A --add url https://example.com/
    $ did notes did:example:test:B --add url https://example.com/
    $ did notes did:example:test:C --add url https://example.org/
    $ did notes --find url https://example.com/
    did:example:test:A
    did:example:test:B
    $ did notes --get url
    did:example:test:A url https://example.com/
    did:example:test:B url https://example.com/
    did:example:test:C url https://example.org/

The notes data is stored in the `config.jsonld` file in your local DID dir.  It
can be freely edited as needed.  **Warning**: This file is *not* currently safe
to write to concurrently!

### Key Management

A DID has a number of application suite paramters that can store keys.  Keys
are managed with the with the `authn-*` commands.  To inspect the keys use
`info`:

    # show the DID JSON including keys
    did info did:example:1234

    # show more readable summary
    did info did:example:1234 -f human

    # show summary with public keys
    did info did:example:1234 -f human --public-key

    # show local summary with private keys
    did info did:example:1234 -f human -L local --private-key

Key material can be added and removed with `authn-add` and `authn-remove`.  A
unique key id will be generated.  Note that the updates will be automatically
registered on the ledger unless `--no-register` is provided:

    # add a public key
    did authn-add did:example:1234 -p PUBLICKEYINFO

    # add a public and private key
    did authn-add did:example:1234 -p PUBLICKEYINFO -P PRIVATEKEYINFO

    # remove a key
    did authn-remove did:example:1234 did:example:1234#authn-key-123

## Examples

Basic generate and check DID is on ledger:

    # generate and register on ledger
    did generate -r # generate and register on ledger
    # wait a few moments
    # ...
    did info DID -f found
    # should output "FOUND"!

More extreme checking if ledger has details of multiple hosts. As of this
writing, Veres One has multiple testnet hosts hardcoded, but you can specifiy
your own with multiple `-H` options:

    # generate and register on ledger
    did generate -r # generate and register to ledger
    # check *all* local ledger hosts
    did info DID -f found -L all

Depending on the ledger, you may be able to see consensus happening after a
generate:

    # start a retry loop, see info --help for other options
    did info DID -f found -L all --retry

Use an accelerator to register a DID faster. This assumes you have registered
`did:ex:my-did` at the accelerator:

    did generate -r -a did:ex:test:my-did -A accelerator.example.com

Split creation and later register to multiple ledgers (because you are an
expert and have solid reasons for doing this):

    # generate with a private name, do not register
    did generate --name my-did
    # ... time passes
    # ...
    # ... grrr, I forgot the long DID name
    did list
    ... many many DIDs ...
    # hmm... lots of random DID names, which one is it?
    did notes --get name
    ... many other DIDs with names ...
    did:example:test:1234 name my-did
    # ah! there it is!
    # register on a ledger
    did register did:example:test:1234
    # i'd like to use on other ledgers too
    did register -H ledger2.example.com did:example:test:1234

Show which DIDs have a note about being on a ledger:

    did notes --get ledger

Show all DIDs on a specific ledger:

    did notes --find ledger veres:test

Export public or private DID data:

    did export did:example:test:1234
    did export did:example:test:1234 --private

Import a private DID file from elsewhere:

    did import ./my-did.json

Tips and tricks:

    # which DIDs did I register on the test ledger?
    for did in `did list`; do echo $did; did info -f found $did; done

    # import from remote site
    ssh me@example.com did export did:example:test:1234 --private | did import

    # reload DIDs on a dev ledger after a wipe
    did notes --find ledger veres:dev | xargs -I {} did register -m dev {}
    # alternative
    for d in `did notes --find ledger veres:dev`; do did register -m dev $did; done

## Roadmap

There are plans to support the following other commands and features:

  * Rotating authentication credentials
  * Adding and removing authorization capability descriptions
  * Adding and removing service descriptions
  * Checking the validity of a DID (deep blockchain check)

## Support

Bugs, suggestions, requests, and code issues:

  * https://github.com/digitalbazaar/did-client/issues

Commercial support is available upon request from [Digital Bazaar][]:

  * support@digitalbazaar.com

[Digital Bazaar]: https://digitalbazaar.com/
