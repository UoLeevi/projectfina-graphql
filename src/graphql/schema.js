import { makeExecutableSchema } from 'graphql-tools';
import resolvers from './resolvers';

const typeDefs = `
  scalar Date

  interface Node {
    uuid: ID!
    name: String!
  }

  interface Connection {
    edges: [Edge!]!
  }

  interface Edge {
    cursor: String
    node: Node!
  }

  type Market {
    uuid: ID!
    name: String
    mic: String
    instruments(uuid: ID): [Instrument!]!
  }

  type Instrument implements Node {
    uuid: ID!
    symbol: String!
    name: String!
    isin: String
    currency: String
    sector: String
    market: Market!
    eod_quotes(last: Int = 0, offset: Int = 0): [EodQuote!]
  }

  type Watchlist implements Node {
    uuid: ID!
    name: String!
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

  type User implements Node {
    uuid: ID!
    name: String!
    first_name: String
    last_name: String
    logins(uuid: ID): [Login!]!
    groupsConnection: UserGroupsConnection
    watchlistsConnection: UserWatchlistsConnection
  }

  type UserGroupsConnection implements Connection {
    edges: [UserGroupsEdge!]!
  }

  type UserGroupsEdge implements Edge {
    cursor: String!
    node: Group!
    permission_mask: Int!
  }

  type UserWatchlistsConnection implements Connection {
    edges: [UserWatchlistsEdge!]!
  }

  type UserWatchlistsEdge implements Edge {
    cursor: String!
    node: Watchlist!
    permission_mask: Int!
  }

  type Login {
    uuid: ID!
    email: String
    user: User
  }

  type Group implements Node {
    uuid: ID!
    name: String!
    usersConnection(uuid: ID): GroupUsersConnection
  }

  type GroupUsersConnection implements Connection {
    edges: [GroupUsersEdge!]!
  }

  type GroupUsersEdge implements Edge {
    cursor: String!
    node: User!
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
