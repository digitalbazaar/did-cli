module.exports = {
  '@context': [{
    '@version': 1.1,
    id: '@id',
    type: '@type',
    schema: 'http://schema.org/',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    name: 'schema:name',
    description: 'schema:description',
    url: 'schema:url',
    ledger: 'urn:did-client:ledger',
    ledgerMode: 'urn:did-client:ledgerMode',
    publishedHost: 'urn:did-client:publishedHost',
    log: {
      '@id': 'urn:did-client:log',
      '@container': '@list'
    },
    created: {
      '@id': 'schema:dataCreated',
      '@type': 'xsd:dateTime'
    },
    modified: {
      '@id': 'schema:dataModified',
      '@type': 'xsd:dateTime'
    },
    published: {
      '@id': 'schema:dataPublished',
      '@type': 'xsd:dateTime'
    },
    dids: {
      '@id': 'urn:did-client:did',
      '@container': '@id'
    }
  }],
  'urn:did-client:config:version': '1',
  'urn:did-client:notes:auto': ['created', 'ledger'],
  dids: {}
};
