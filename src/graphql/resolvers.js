import db from '../db';

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
    async markets(parent, args, context, info) {
      const res = await db.query(`
        SELECT m.* 
          FROM markets m;
      `);
      return res.rows;
    },
  },
  Market: {
    instruments({ uuid }, args, context, info) {
      const res = await db.query(`
        SELECT i.*
          FROM instruments i
          WHERE i.market_uuid = $1::uuid;
      `, 
      [uuid]);
      return res.rows;
    }
  },
  Instrument: {
    market({ market_uuid }, args, context, info) {
      return markets
        .filter(market => market.uuid === market_uuid)[0];
    }
  }
};
