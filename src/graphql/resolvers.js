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
          ${ uuid ? 'AND i.uuid = $2::uuid' : '' };
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
          ORDER BY e.date DESC
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
          ${ uuid ? 'AND i.uuid = $2::uuid' : '' };
        `, 
        uuid ? [watchlist.uuid, uuid] : [watchlist.uuid]);
      return res.rows;
    }
  },
  User: {
    name(user, { uuid }, context, info) {
      return `${user.first_name} ${user.last_name}`;
    },
    async logins(user, { uuid }, context, info) {
      const res = await db.query(`
        SELECT l.*
          FROM logins l
          WHERE l.user_uuid = $1::uuid
          ${ uuid ? 'AND l.uuid = $2::uuid' : '' };
        `, 
        uuid ? [user.uuid, uuid] : [user.uuid]);
      return res.rows;
    },
    groupsConnection(user, args, context, info) {
      return { user_uuid: user.uuid, type: "UserGroupsConnection" };
    },
    watchlistsConnection(user, args, context, info) {
      return { user_uuid: user.uuid, type: "UserWatchlistsConnection" };
    }
  },
  UserGroupsConnection: {
    async edges(connection, { uuid }, context, info) {
      if (connection.user_uuid === context.claims.sub) 
      {
        const res = await db.query(`
          SELECT u_x_g.*
            FROM users_x_groups u_x_g
            WHERE u_x_g.user_uuid = $1::uuid
            ${ uuid ? 'AND u_x_g.group_uuid = $2::uuid' : '' };
          `, 
          uuid 
            ? [connection.user_uuid, uuid] 
            : [connection.user_uuid]);
        return res.rows.map(row => ({ ...row, type: "UserGroupsEdge" }));
      } 
      else
      {
        const res = await db.query(`
          SELECT u_x_g.*
            FROM users_x_groups u_x_g
            JOIN users_x_groups my_u_x_g ON u_x_g.group_uuid = my_u_x_g.group_uuid
            WHERE u_x_g.user_uuid = $1::uuid
            AND my_u_x_g.user_uuid = $2::uuid
            AND (my_u_x_g.permission_mask & B'00000011'::bit(8))::int != 0
            ${ uuid ? 'AND u_x_g.group_uuid = $3::uuid' : '' };
          `, 
          uuid 
            ? [connection.user_uuid, context.claims.sub, uuid] 
            : [connection.user_uuid, context.claims.sub]);
          return res.rows.map(row => ({ ...row, type: "UserGroupsEdge" }));
      }
    }
  },
  UserGroupsEdge: {
    cursor(edge, args, context, info) {
      return Buffer.from(`${edge.user_uuid},${edge.group_uuid}`).toString('base64');
    },
    async node(edge, args, context, info) {
      const res = await db.query(`
        SELECT g.*
          FROM groups g
          WHERE g.uuid = $1::uuid;
        `,
        [edge.group_uuid]);
        return { ...res.rows[0], type: "Group" };
    }
  },
  UserWatchlistsConnection: {
    async edges(connection, { uuid }, context, info) {
      if (connection.user_uuid === context.claims.sub) 
      {
        const res = await db.query(`
          SELECT DISTINCT ON (w.uuid)
            w.uuid watchlist_uuid,
            u_x_w.permission_mask | u_x_g.permission_mask & g_x_w.permission_mask permission_mask
            FROM watchlists w
            LEFT JOIN users_x_watchlists u_x_w ON w.uuid = u_x_w.watchlist_uuid
            LEFT JOIN groups_x_watchlists g_x_w ON w.uuid = g_x_w.watchlist_uuid
            LEFT JOIN users_x_groups u_x_g ON g_x_w.group_uuid = u_x_g.group_uuid
            WHERE u_x_w.user_uuid = $1::uuid OR u_x_g.user_uuid = $1::uuid
            ${ uuid ? 'AND w.uuid = $2::uuid' : '' }
            ORDER BY watchlist_uuid, permission_mask DESC;
          `, 
          uuid 
            ? [connection.user_uuid, uuid] 
            : [connection.user_uuid]);
        return res.rows.map(row => ({ ...row, type: "UserWatchlistsEdge" }));
      } 
      else
      {
        const res = await db.query(`
          SELECT DISTINCT ON (w.uuid)
            w.uuid watchlist_uuid,
            u_x_w.permission_mask | u_x_g.permission_mask & g_x_w.permission_mask permission_mask
            FROM (
              SELECT DISTINCT ON (w.uuid)
                w.uuid,
                u_x_w.permission_mask | u_x_g.permission_mask & g_x_w.permission_mask my_permission_mask
                FROM watchlists w
                LEFT JOIN users_x_watchlists u_x_w ON w.uuid = u_x_w.watchlist_uuid
                LEFT JOIN groups_x_watchlists g_x_w ON w.uuid = g_x_w.watchlist_uuid
                LEFT JOIN users_x_groups u_x_g ON g_x_w.group_uuid = u_x_g.group_uuid
                WHERE u_x_w.user_uuid = $2::uuid OR u_x_g.user_uuid = $2::uuid
                ORDER BY w.uuid, my_permission_mask DESC
              ) w
            LEFT JOIN users_x_watchlists u_x_w ON w.uuid = u_x_w.watchlist_uuid
            LEFT JOIN groups_x_watchlists g_x_w ON w.uuid = g_x_w.watchlist_uuid
            LEFT JOIN users_x_groups u_x_g ON g_x_w.group_uuid = u_x_g.group_uuid
            WHERE u_x_w.user_uuid = $1::uuid OR u_x_g.user_uuid = $1::uuid
            AND (w.my_permission_mask & B'00000011'::bit(8))::int != 0 
            ${ uuid ? 'AND w.uuid = $3::uuid' : '' }
            ORDER BY watchlist_uuid, permission_mask DESC;
          `, 
          uuid 
            ? [connection.user_uuid, context.claims.sub, uuid] 
            : [connection.user_uuid, context.claims.sub]);
          return res.rows.map(row => ({ ...row, type: "UserWatchlistsEdge" }));
      }
    }
  },
  UserWatchlistsEdge: {
    cursor(edge, args, context, info) {
      return Buffer.from(`${edge.user_uuid},${edge.watchlist_uuid}`).toString('base64');
    },
    async node(edge, args, context, info) {
      const res = await db.query(`
        SELECT w.*
          FROM watchlists w
          WHERE w.uuid = $1::uuid;
        `,
        [edge.watchlist_uuid]);
        return { ...res.rows[0], type: "Watchlist" };
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
    async usersConnection(group, args, context, info) {
      const canRead = await db.query(`
        SELECT EXISTS(
          SELECT 1 
          FROM users_x_groups u_x_g
          WHERE u_x_g.group_uuid = $1::uuid
          AND u_x_g.user_uuid = $2::uuid
          AND (u_x_g.permission_mask & B'00000011'::bit(8))::int != 0);
        `, 
        [group.uuid, context.claims.sub]);
      return canRead ? { group_uuid: group.uuid, type: "GroupUsersConnection" } : null;
    },
    async watchlistsConnection(group, args, context, info) {
      const canRead = await db.query(`
        SELECT EXISTS(
          SELECT 1 
          FROM users_x_groups u_x_g
          WHERE u_x_g.group_uuid = $1::uuid
          AND u_x_g.user_uuid = $2::uuid
          AND (u_x_g.permission_mask & B'00000011'::bit(8))::int != 0);
        `, 
        [group.uuid, context.claims.sub]);
      return canRead ? { group_uuid: group.uuid, type: "GroupWatchlistsConnection" } : null;
    }
  },
  GroupUsersConnection: {
    async edges(connection, { uuid }, context, info) {
      const res = await db.query(`
        SELECT u_x_g.*
          FROM users_x_groups u_x_g
          WHERE u_x_g.group_uuid = $1::uuid
          ${ uuid ? 'AND u_x_g.user_uuid = $2::uuid' : '' };
        `, 
        uuid 
          ? [connection.group_uuid, uuid] 
          : [connection.group_uuid]);
        return res.rows.map(row => ({ ...row, type: "GroupUsersEdge" }));
    }
  },
  GroupUsersEdge: {
    cursor(edge, args, context, info) {
      return Buffer.from(`${edge.group_uuid},${edge.user_uuid}`).toString('base64');
    },
    async node(edge, args, context, info) {
      const res = await db.query(`
        SELECT u.*
          FROM users u
          WHERE u.uuid = $1::uuid;
        `,
        [edge.user_uuid]);
      return { ...res.rows[0], type: "User" };
    }
  },
  GroupWatchlistsConnection: {
    async edges(connection, { uuid }, context, info) {
      const res = await db.query(`
        SELECT g_x_w.*
          FROM groups_x_watchlists g_x_w
          WHERE g_x_w.group_uuid = $1::uuid
          ${ uuid ? 'AND g_x_w.watchlist_uuid = $2::uuid' : '' };
        `, 
        uuid 
          ? [connection.group_uuid, uuid] 
          : [connection.group_uuid]);
        return res.rows.map(row => ({ ...row, type: "GroupWatchlistsEdge" }));
    }
  },
  GroupWatchlistsEdge: {
    cursor(edge, args, context, info) {
      return Buffer.from(`${edge.group_uuid},${edge.watchlist_uuid}`).toString('base64');
    },
    async node(edge, args, context, info) {
      const res = await db.query(`
        SELECT w.*
          FROM watchlists w
          WHERE w.uuid = $1::uuid;
        `,
        [edge.watchlist_uuid]);
      return { ...res.rows[0], type: "Watchlist" };
    }
  },
  Node: {
    __resolveType(node, context, info) {
      return node.type;
    }
  },
  Connection: {
    __resolveType(connection, context, info) {
      return connection.type;
    }
  },
  Edge: {
    __resolveType(edge, context, info) {
      return edge.type;
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
