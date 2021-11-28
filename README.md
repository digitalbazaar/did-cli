# Decentralized Identifier client CLI _(did-cli)_

> A command line client for managing DIDs, VCs, zCaps, and corresponding cryptographic key pairs.

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

### Decentralized Identifiers (DIDs)

#### `did:key` Method - Create

To generate a new `did:key` DID:

```
./did id create --method <method>
```

Options:

* `method` - Supported methods: 'key' (`did:key`). Default: 'key'.

Examples:

```
./did id create
{
  "id": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
  "secretKeySeed": "z1AZK4h5w5YZkKYEgqtcFfvSbWQ3tZ3ZFgmLsXMZsTVoeK7",
  "didDocument": {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
      "https://w3id.org/security/suites/x25519-2020/v1"
    ],
    "id": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
    "verificationMethod": [
      {
        "id": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
        "type": "Ed25519VerificationKey2020",
        "controller": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
        "publicKeyMultibase": "z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR"
      }
    ],
    "authentication": [
      "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR"
    ],
    "assertionMethod": [
      "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR"
    ],
    "capabilityDelegation": [
      "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR"
    ],
    "capabilityInvocation": [
      "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR"
    ],
    "keyAgreement": [
      {
        "id": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6LSiMBrnXGbSJ6ZGQ3yRu8F8y75oR85fpq6NBrxHUjB4M3A",
        "type": "X25519KeyAgreementKey2020",
        "controller": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
        "publicKeyMultibase": "z6LSiMBrnXGbSJ6ZGQ3yRu8F8y75oR85fpq6NBrxHUjB4M3A"
      }
    ]
  }
}
```

If you have a secret key seed already, set the `SECRET_KEY_SEED` env variable,
and the DID will be deterministically generated from it:

```
SECRET_KEY_SEED=z1AZK4h5w5YZkKYEgqtcFfvSbWQ3tZ3ZFgmLsXMZsTVoeK7 ./did id create
// same as previous example
```

### zCaps (Authorization Capabilities)

#### Creating a Root zCap

To create a root zcap that allows `read` and `write` actions to the 
`https://example.com/api` URL:

```
ZCAP_CONTROLLER_KEY_SEED=z1AZK4h5w5YZkKYEgqtcFfvSbWQ3tZ3ZFgmLsXMZsTVoeK7 \
  ./did zcap create \
  --controller 'did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR' \
  --url 'https://example.com/api'
{
  "rootCapability": {
    "@context": [
      "https://w3id.org/zcap/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fapi",
    "controller": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
    "invocationTarget": "https://example.com/api"
  },
  "encoded": "zDWWVahKWhXpe9vYhuSeaRYDZradgnuhfJUnQGAGdbsXRPbD16AsJq6no2b9iHjZGqRfKSWRz9gGer1uJfwG5awKshKhWVuBK5fRJTwN54G4MRAhbMJsUKvwC1VYto5gkNEcoNqvFWNSgucumD4vzarDfDfyXG6BXFbk2SN314p5vgPPEkxkWkqyWdMcWAoFDJcYFK5WGdwKxs2xsZazJgPk8aJrtPRKvSVVQUb2i5qLguZn21JNuk6sNrC4SPhcskkbsEEctMzpxVr75qLX9zWGEaJwgCdZDPGwS4YKuvgHbRW6jU7wVUoTcFNSzevhK3hAswXDzNZp7kmAxJMZBtaBhoeTV9tG75DX1ek"
}
```

#### Delegating a zCap

To delegate an authorization capability:

```sh
export ADMIN_DID=did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR
export ADMIN_SECRET_KEY_SEED=z1AZK4h5w5YZkKYEgqtcFfvSbWQ3tZ3ZFgmLsXMZsTVoeK7
export TEACHER_DID=did:key:z6Mks9725jfFf4SVJh8cmUed2uC9ECAk7GvjYH8CysfdvGuM

ZCAP_CONTROLLER_KEY_SEED=$ADMIN_SECRET_KEY_SEED ./did zcap delegate \
  --delegatee $TEACHER_DID \
  --url https://example.com/documents \
  --controller $ADMIN_DID \
  --allow read
{
  "delegatedCapability": {
    "@context": [
      "https://w3id.org/zcap/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": "urn:zcap:delegated:zATezxfPKbGAW5MermnA6N2",
    "parentCapability": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fdocuments",
    "invocationTarget": "https://example.com/documents",
    "controller": "did:key:z6Mks9725jfFf4SVJh8cmUed2uC9ECAk7GvjYH8CysfdvGuM",
    "expires": "2022-11-28T20:42:57Z",
    "allowedAction": [
      "read"
    ],
    "proof": {
      "type": "Ed25519Signature2020",
      "created": "2021-11-28T20:42:57Z",
      "verificationMethod": "did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR#z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR",
      "proofPurpose": "capabilityDelegation",
      "capabilityChain": [
        "urn:zcap:root:https%3A%2F%2Fexample.com%2Fdocuments"
      ],
      "proofValue": "z4jo2vxkF59G2wmdjQa412YEpYwjSbfZd5pee9NpLDsnKp81KiuL5bA9v4L4LbqmpFbxrndiY76HPHov9fZx977nf"
    }
  },
  "encoded": "zWE9iCuaZNYTg5CA2HokbtjHcET3TnM7PDWgmYxmmT9zZqMM9cxPUJNi9URT3gbzSooPGKtevPix6saAE3TF6Zo44FGk6VK2pMpHHmdcQLjLDCaeXBv6KyPG6HkDiCu38UL1v66M9d88qUaYeC9Vr3gu3y6qMijzwyWzpKkMd98Vhchybjes1kEh6BDmDpsD9SDkqaGxPc31SM7T19UaAaCy9Tyqg7Gpq9qjgwK2B37fARX1XN1rAgpJnr8SsctdYuC8BCwUaA9aSVhufokYePV7SLwdmAVBEXaAAKJFkeZitLs8PZr1QX3pDExYJBRsqF8g5w8tXCjeXweniPiofzbA3aycEzMzDGRAUEQV4mUjJp8R2PwLpuqVr8K7ExX2yr8kx9LbkPGvnLSVNHcgYuiZToSehdvi8R2cioecBB5HvtEgJB7EuEjoekmqnUHrvm8r7iiD1RsnZfC2uF2sMnuu3wtAVdzVJS9uDiEUhKEoCAf6peJqW3cgvhWpCsNkr2Ed2WVcG3k4wBxqdEC2rH69H55Ao7SoWjkeaKvNLNzF2hYFze8w7ABP9vL6MyqkW7imEa8uQytFNAn35kNYyAMJppRsZwD8aE6AspLkmdrgZBginJVxz5YdzgZHfy2KUasZFs2YU7BRAWoguuXdCoGfeMuAQhkbV5WLPnXVGyYLHJd3t8AmQMHXKT3aMxidN9LrcpYiU6gFP1bTSvFUVxD775CQ1NrNJsLUhSnWWAtM7EdJoEbWuthy2mwsV26sNXsEcjekxQQi5svrSDJdsQ6BX81Dduc4cZKRZxhmf5w7A6GxLvY5uLw3KCEZaRgL4Wi3X26bm78ywcosBQgBsb5YJyFBfz4rmLEZrx4wqbxMUWZE3h9K2rFgt3ysNoSCpEnuvaGyriULad1hg77MN5H9G2rodBjembitWwfgFCR7NSG5KpM4ZDBmoJQQ76CqD8oqqTADGfXVSbxr3tdtx1g6XzhQw4kTwPR16DeA7PUBCf3y9sqDnUmdt5cWk1kNsFDx54VZjnUasXzyZJ3aEiC5uXHWujgMGANN6s6tZFoT94KQAnFvEXhj5erYVYZBwqpSYBMZ5gB51orJXgXxzSHXba"
}
```

### Key Pairs

#### Generating a Key Pair

To generate a new public/private key pair:

```
 ./did key create
{
  "secretKeySeed": "z1AhV1bADy7RepJ64mvH7Kk7htFNGc7EA1WA5nGzLSTWc6o",
  "keyPair": {
    "type": "Ed25519VerificationKey2020",
    "@context": "https://w3id.org/security/suites/ed25519-2020/v1",
    "publicKeyMultibase": "z6MkmDMjfkjs9XPCN1LfoQQRHz1mJ8PEdiVYC66XKhj3wGyB",
    "privateKeyMultibase": "zrv3wmB9AVHitGUTEf9MVMB6afscXMmzGY7hwuYL5gZZdspFr2DDrTA97qzZS6T1MsJM4mTKVWQWkjY5asc8FBppKt9"
  }
}
```

If you have a secret key seed already, set the `SECRET_KEY_SEED` env variable,
and the key pair will be deterministically generated from it:

```
SECRET_KEY_SEED=z1Ajrg3wpDYiKS1EKAZKDd8qwR5mG3wKvh6gYi5YEz9T89P ./did key create
{
  "secretKeySeed": "z1Ajrg3wpDYiKS1EKAZKDd8qwR5mG3wKvh6gYi5YEz9T89P",
  "keyPair": {
    "type": "Ed25519VerificationKey2020",
    "@context": "https://w3id.org/security/suites/ed25519-2020/v1",
    "publicKeyMultibase": "z6Mkf9XLrKqb6kch96MU61aciKrnQwQmBnFw9MGpyqHor81V",
    "privateKeyMultibase": "zrv4ef4DVKCmCzy9733LKCnghDP1mytArm7Jddtnq54M1sVThc95bxJ2H4TiuWXRChjGHWtocqKciPrnqUBAatLUKqq"
  }
}
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
