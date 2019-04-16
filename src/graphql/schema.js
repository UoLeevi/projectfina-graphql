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

  type User {
    uuid: ID
    first_name: String
    last_name: String
  }

  type Query {
    markets: [Market!]!
    me: User
  }
`;

export default makeExecutableSchema({
  typeDefs,
  resolvers
});
