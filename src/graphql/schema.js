import { makeExecutableSchema } from 'graphql-tools';
import resolvers from './resolvers';

const typeDefs = `
  scalar Date

  type Market {
    uuid: ID!
    name: String
    mic: String
    instruments(uuid: ID): [Instrument!]!
  }

  type Instrument {
    uuid: ID!
    symbol: String
    name: String
    isin: String
    currency: String
    sector: String
    market: Market!
    eod_quotes(last: Int = 0, offset: Int = 0): [EodQuote!]
  }

  type Watchlist {
    uuid: ID!
    name: String
    instruments(uuid: ID): [Instrument!]!
  }

  type EodQuote {
    uuid: ID!
    instrument: Instrument!
    date: Date
    price_open: Float
    price_close: Float
    price_high: Float
    price_low: Float
    turnover: Float
    quantity: Float
  }

  type User {
    uuid: ID!
    first_name: String
    last_name: String
    logins(uuid: ID): [Login!]!
    groups(uuid: ID): [GroupMembership!]!
    watchlists(uuid: ID): [Watchlist!]!
  }

  type Login {
    uuid: ID!
    email: String
    user: User
  }

  type Group {
    uuid: ID!
    name: String
    members(uuid: ID): [GroupMembership!]!
  }

  type GroupMembership {
    permission_mask: Int!
    group: Group!
    user: User!
  }

  type Query {
    instruments(uuid: ID): [Instrument!]!
    markets(uuid: ID, mic: String): [Market!]!
    me: User
  }
`;

export default makeExecutableSchema({
  typeDefs,
  resolvers
});
