import { makeExecutableSchema } from 'graphql-tools';
import resolvers from './resolvers';

const typeDefs = `
  type Market {
    uuid: ID
    name: String
    mic: String
    instruments: [Instrument!]!
  }

  type Instrument {
    uuid: ID
    symbol: String
    name: String
    isin: String
    currency: String
    sector: String
    market: Market!
  }

  type Query {
    markets: [Market!]!
  }
`;

export default makeExecutableSchema({
  typeDefs,
  resolvers
});
