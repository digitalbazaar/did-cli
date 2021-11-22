# Decentralized Identifier client CLI _(did-cli)_

> A command line client for managing DIDs, VCs, zCaps, and corresponding cryptographic keys.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Commercial Support](#commercial-support)
- [License](#license)

## Background

By default, keys and DID Documents will be stored in `~/.dids/<method>/`,
see [Setting Up Storage](STORAGE.md) for more details.

Relevant Specifications:

* [Decentralized Identifiers (DIDs) v1.0](https://www.w3.org/TR/did-core/)

## Install

Requires Node.js >= v14.

Install in a development directory:

    npm install did-cli
    ./node_modules/.bin/did ...

Install globally:

    npm install -g did-cli
    did ...

Run from npx:

    npx did-cli ...

## Usage

Help is available with the `--help/-h` command line option:

```
./did -h
./did COMMAND -h
```

## Contribute

See [the contribute file](https://github.com/digitalbazaar/bedrock/blob/master/CONTRIBUTING.md)!

PRs accepted.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## Commercial Support

Commercial support for this library is available upon request from
Digital Bazaar: support@digitalbazaar.com

## License

[New BSD License (3-clause)](LICENSE) © Digital Bazaar
