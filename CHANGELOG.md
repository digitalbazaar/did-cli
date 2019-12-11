# did-cli ChangeLog

## 0.5.0

### Changed
- **BREAKING**: Uses `did-veres-one` v8.0, changed `capabilityAction` values 
  in invocation proofs.
- General refactoring.
- **BREAKING**: Stores DID Documents and keys separately, in `~/.dids/`. See
  docstring in `lib/storage.js` for more details.
- **BREAKING**: No longer supports the concept of 'import' or 'export' of DIDs.
- **BREAKING**: No longer supports registering from DID Doc via stdin (since
  importing private keys is awkward/not possible via stdin).

## 0.4.1 - 2019-06-20

### Changed
- Use yargs@13. The following vulnerabilities are fixed with an upgrade:
  https://snyk.io/vuln/npm:mem:20180117

## 0.4.0 - 2019-06-19

### Changed
- Change package name to `did-cli`.
- Use did-veres-one@5.

### Removed
- **BREAKING**: Veres One `authn-remove` API.

## 0.3.2 - 2018-11-05

### Fixed

- Fix dependencies to work with current Testnet.

## 0.3.1 - 2018-04-26

### Fixed
- Fix typos.
- Only RSA authentication keys currently supported.

## 0.3.0 - 2018-03-06

### Added
- Structure to support multiple ledgers.
- More commands.
- Add config system.

### Changed
- Update for latest Veres One API.
- Many many other updates.

## 0.2.0 - 2018-02-24

### Added
- Enable use of Ed25519 keys.
- Add basic ld-ocap support.

## 0.1.1 - 2017-09-29

### Changed
- Use faster Equihash proofs on testnet.

## 0.1.0 - 2017-09-29

- See git history for changes.
