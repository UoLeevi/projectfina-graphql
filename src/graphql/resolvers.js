import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
import db from '../db';

export default {
  Query: {
    async markets(obj, { uuid, mic }, context, info) {
      const res = await db.query(`
        SELECT m.* 
          FROM markets m
          ${ uuid 
            ? 'WHERE m.uuid = $1::uuid' 
            : mic
              ? 'WHERE m.mic = $1::text'
              : '' };
        `,
        uuid ? [uuid] : mic ? [mic] : undefined);
      return res.rows;
    },
    async instruments(obj, { uuid }, context, info) {
      const res = await db.query(`
        SELECT i.*
          FROM instruments i
          ${ uuid ? 'WHERE i.uuid = $1::uuid' : '' };
        `,
        uuid ? [uuid] : undefined);
      return res.rows;
    },
    async me(obj, args, context, info) {
      if (!context.claims || !context.claims.sub)
        return null;

      const res = await db.query(`
        SELECT u.* 
          FROM users u
          WHERE u.uuid = $1::uuid;
        `,
        [context.claims.sub]);
      return res.rows ? res.rows[0] : null;
    },
  },
  Market: {
    async instruments(market, { uuid }, context, info) {
      const res = await db.query(`
        SELECT i.*
          FROM instruments i
          WHERE i.market_uuid = $1::uuid
          ${uuid ? 'AND i.uuid = $2::uuid' : '' };
        `,
        uuid ? [market.uuid, uuid] : [market.uuid]);
      return res.rows;
    }
  },
  Instrument: {
    async market(instrument, args, context, info) {
      const res = await db.query(`
        SELECT m.*
          FROM markets m
          WHERE m.uuid = $1::uuid;
        `, 
        [instrument.market_uuid]);
      return res.rows[0];
    },
    async eod_quotes(instrument, { last, offset, uuid }, context, info) {
      const res = await db.query(`
        SELECT e.*
          FROM eod_quotes e
          WHERE e.instrument_uuid = $1::uuid
          ${ uuid ? 'AND e.uuid = $4::uuid' : '' }
          LIMIT $2::integer OFFSET $3::integer;
        `, 
        uuid ? [instrument.uuid, last, offset, uuid] : [instrument.uuid, last, offset]);
      return res.rows;
    }
  },
  EodQuote: {
    async instrument(eod_quote, args, context, info) {
      const res = await db.query(`
        SELECT i.*
          FROM instruments i
          WHERE i.uuid = $1::uuid;
        `, 
        [eod_quote.instrument_uuid]);
      return res.rows[0];
    }
  },
  Watchlist: {
    async instruments(watchlist, { uuid }, context, info) {
      const res = await db.query(`
        SELECT i.*
          FROM instruments i
          LEFT JOIN instruments_x_watchlists i_x_w ON i.uuid = i_x_w.instrument_uuid
          WHERE i_x_w.watchlist_uuid = $1::uuid
          ${uuid ? 'AND i.uuid = $2::uuid' : '' };
        `, 
        uuid ? [watchlist.uuid, uuid] : [watchlist.uuid]);
      return res.rows;
    }
  },
  User: {
    async logins(user, { uuid }, context, info) {
      const res = await db.query(`
        SELECT l.*
          FROM logins l
          WHERE l.user_uuid = $1::uuid
          ${uuid ? 'AND l.uuid = $2::uuid' : '' };
        `, 
        uuid ? [user.uuid] : [user.uuid, uuid]);
      return res.rows;
    },
    async groups(user, { uuid }, context, info) {
      const res = await db.query(`
        SELECT g.*
          FROM groups g
          LEFT JOIN users_x_groups u_x_g ON g.uuid = u_x_g.group_uuid
          WHERE u_x_g.user_uuid = $1::uuid
          ${uuid ? 'AND g.uuid = $2::uuid' : '' };
        `, 
        uuid ? [user.uuid] : [user.uuid, uuid]);
      return res.rows;
    },
    async watchlists(user, { uuid }, context, info) {
      const res = await db.query(`
        SELECT w.*
          FROM watchlists w
          LEFT JOIN users_x_watchlists u_x_w ON w.uuid = u_x_w.watchlist_uuid
          WHERE u_x_w.user_uuid = $1::uuid
          ${uuid ? 'AND w.uuid = $2::uuid' : '' };
        `, 
        uuid ? [user.uuid] : [user.uuid, uuid]);
      return res.rows;
    }
  },
  Login: {
    async user(login, args, context, info) {
      const res = await db.query(`
        SELECT u.*
          FROM user u
          WHERE u.uuid = $1::uuid;
        `, 
        [login.user_uuid]);
      return res.rows[0];
    }
  },
  Group: {
    async users(group, { uuid }, context, info) {
      const res = await db.query(`
        SELECT u.*
          FROM users u
          LEFT JOIN users_x_groups u_x_g ON u.uuid = u_x_g.user_uuid
          WHERE u_x_g.group_uuid = $1::uuid
          ${uuid ? 'AND u.uuid = $2::uuid' : '' };
        `, 
        uuid ? [group.uuid, uuid] : [group.uuid]);
      return res.rows;
    }
  },
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value);
    },
    serialize(value) {
      return value.getTime();
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT)
        return new Date(ast.value);

      return null;
    },
  })
};
