
// This is a (sample) collection of books we'll be able to query
// the GraphQL server for.  A more complete example might fetch
// from an existing data source like a REST API or database.
const markets = [
  {
    uuid: '206c1363-4600-47b4-823b-aaec99844763',
    name: 'Nasdaq Helsinki',
    mic: 'XHEL'
  }
];

const instruments = [
  {
    uuid: '02527fed-eaef-41d8-b068-7c46760f6ed2',
    symbol: 'EQV1V',
    name: 'eQ Oyj',
    market_uuid: '206c1363-4600-47b4-823b-aaec99844763',
    currency: 'EUR',
    isin: 'FI0009009617',
    sector: 'Financials'
  },
  {
    uuid: '0419dc3b-6914-4d96-8ca2-090b1ad78077',
    symbol: 'ALBAV',
    name: 'Ålandsbanken Abp A',
    market_uuid: '206c1363-4600-47b4-823b-aaec99844763',
    currency: 'EUR',
    isin: 'FI0009000103',
    sector: 'Financials'
  },
  {
    uuid: '0474a704-4b49-4c26-b67d-70d4c9271bcd',
    symbol: 'WUF1V',
    name: 'Wulff-Yhtiöt Oyj',
    market_uuid: '206c1363-4600-47b4-823b-aaec99844763',
    currency: 'EUR',
    isin: 'FI0009008452',
    sector: 'Industrials'
  }
];

export default {
  Query: {
    markets(parent, args, context, info) {
      return markets;
    },
  },
  Market: {
    instruments({ uuid }, args, context, info) {
      return instruments
        .filter(instrument => instrument.market_uuid === uuid);
    }
  },
  Instrument: {
    market({ market_uuid }, args, context, info) {
      return markets
        .filter(market => market.uuid === market_uuid)[0];
    }
  }
};
