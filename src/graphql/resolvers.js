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
  Mutation: {
    async createWatchlist(obj, { watchlist }, context, info) {
      if (!context.claims || !context.claims.sub)
        return null;

      let res = await db.query(`
        WITH watchlist AS (
          INSERT INTO watchlists (name, created_by_user_uuid) 
            VALUES ($2::text, $1::uuid) 
            RETURNING *
          )
          INSERT INTO users_x_watchlists (user_uuid, watchlist_uuid, permission_mask)
            SELECT $1::uuid, uuid, B'11111111'::bit(8)
            FROM watchlist
            RETURNING watchlist_uuid;
        `, 
        [context.claims.sub, watchlist.name]);

      const uuid = res.rows[0].watchlist_uuid;

      res = await db.query(`
        SELECT w.* 
          FROM watchlists w
          WHERE w.uuid = $1::uuid;
        `, 
        [uuid]);

      return res.rows[0];
    },
    async deleteWatchlist(obj, { watchlist_uuid }, context, info) {
      if (!context.claims || !context.claims.sub)
        return {
          success: false,
          message: 'Unauthorized'
        };

        const res = await db.query(`
          WITH deleted AS (
            DELETE FROM watchlists w 
              USING watchlist_user_permissions w_u_p
              WHERE w.uuid = $1::uuid
              AND w_u_p.user_uuid = $2::uuid
              AND w.uuid = w_u_p.watchlist_uuid
              AND (w_u_p.permission_mask & B'00010000'::bit(8))::int != 0
              RETURNING *
            ) 
            SELECT COUNT(*) > 0 success
              FROM deleted;
          `, 
          [watchlist_uuid, context.claims.sub]);

        const success = res.rows[0].success;

        return {
          success,
          message: success 
            ? 'Delete successful' 
            : 'Nothing was deleted'
        };
    },
    async addToWatchlist(obj, { instrument_uuid, watchlist_uuid }, context, info) {
      if (!context.claims || !context.claims.sub)
        return {
          success: false,
          message: 'Unauthorized'
        };

      const canEdit = await db.query(`
        SELECT EXISTS(
          SELECT 1 
          FROM watchlist_user_permissions w_u_p
          WHERE w_u_p.watchlist_uuid = $1::uuid
          AND w_u_p.user_uuid = $2::uuid
          AND (w_u_p.permission_mask & B'00001000'::bit(8))::int != 0);
        `, 
        [watchlist_uuid, context.claims.sub]);

      if (!canEdit)
        return {
          success: false,
          message: 'Not allowed'
        };

      const res = await db.query(`
        WITH inserted AS (
          INSERT INTO instruments_x_watchlists (instrument_uuid, watchlist_uuid)
            VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING
            RETURNING *
          ) 
          SELECT COUNT(*) > 0 success
            FROM inserted;
        `, 
        [instrument_uuid, watchlist_uuid]);

      const success = res.rows[0].success;

      return {
        success,
        message: success 
          ? 'Instrument added successfully' 
          : 'Nothing was inserted'
      };
    },
    async removeFromWatchlist(obj, { instrument_uuid, watchlist_uuid }, context, info) {
      if (!context.claims || !context.claims.sub)
        return {
          success: false,
          message: 'Unauthorized'
        };

      const canEdit = await db.query(`
        SELECT EXISTS(
          SELECT 1 
          FROM watchlist_user_permissions w_u_p
          WHERE w_u_p.watchlist_uuid = $1::uuid
          AND w_u_p.user_uuid = $2::uuid
          AND (w_u_p.permission_mask & B'00001000'::bit(8))::int != 0);
        `, 
        [watchlist_uuid, context.claims.sub]);

      if (!canEdit)
        return {
          success: false,
          message: 'Not allowed'
        };

      const res = await db.query(`
        WITH removed AS (
          DELETE FROM instruments_x_watchlists i_x_w
            WHERE i_x_w.instrument_uuid = $1::uuid
            AND i_x_w.watchlist_uuid = $2::uuid
            RETURNING *
          ) 
          SELECT COUNT(*) > 0 success
            FROM removed;
        `, 
        [instrument_uuid, watchlist_uuid]);

      const success = res.rows[0].success;

      return {
        success,
        message: success 
          ? 'Instrument added successfully' 
          : 'Nothing was inserted'
      };
    },
    async createNote(obj, { instrument_uuid, watchlist_uuid, body }, context, info) {
      if (!context.claims || !context.claims.sub)
        return {
          success: false,
          message: 'Unauthorized'
        };

      if (watchlist_uuid) {
        const canEdit = await db.query(`
          SELECT EXISTS(
            SELECT 1 
            FROM watchlist_user_permissions w_u_p
            WHERE w_u_p.watchlist_uuid = $1::uuid
            AND w_u_p.user_uuid = $2::uuid
            AND (w_u_p.permission_mask & B'00001000'::bit(8))::int != 0);
          `, 
          [watchlist_uuid, context.claims.sub]);

        if (!canEdit)
          return {
            success: false,
            message: 'Not allowed'
          };
      }

      let res = await db.query(`
        WITH note AS (
          INSERT INTO notes (body, created_by_user_uuid) 
            VALUES ($2::text, $1::uuid) 
            RETURNING *
          )
          ${watchlist_uuid 
            ? `
              INSERT INTO notes_x_instruments_x_watchlists (note_uuid, instrument_uuid, watchlist_uuid)
                SELECT uuid, $3::uuid, $4::uuid
                FROM note
                RETURNING note_uuid` 
            : `
              INSERT INTO notes_x_instruments (note_uuid, instrument_uuid)
                SELECT uuid, $3::uuid
                FROM note
                RETURNING note_uuid` 
            };
        `, 
        watchlist_uuid 
          ? [context.claims.sub, body, instrument_uuid, watchlist_uuid]
          : [context.claims.sub, body, instrument_uuid]);

      const success = !!res.rows[0].note_uuid;

      return {
        success,
        message: success 
          ? 'Note created successfully' 
          : 'Unable to create note'
      }
    },
    async deleteNote(obj, { note_uuid }, context, info) {
      if (!context.claims || !context.claims.sub)
        return {
          success: false,
          message: 'Unauthorized'
        };

        const res = await db.query(`
          WITH deleted AS (
            DELETE FROM notes n 
              WHERE n.uuid = $1::uuid
              AND n.created_by_user_uuid = $2::uuid
              RETURNING *
            ) 
            SELECT COUNT(*) > 0 success
              FROM deleted;
          `, 
          [note_uuid, context.claims.sub]);

        const success = res.rows[0].success;

        return {
          success,
          message: success 
            ? 'Delete successful' 
            : 'Nothing was deleted'
        };
    }
  },
  SuccessMessage: {

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
    },
    notesConnection(instrument, args, context, info) {
      if (!context.claims || !context.claims.sub)
        return null;

      return { instrument_uuid: instrument.uuid, type: "InstrumentNotesConnection" };
    },
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
  InstrumentNotesConnection: {
    async edges(connection, { watchlist_uuid }, context, info) {
      const res = await db.query(`
        SELECT DISTINCT ON (n.note_uuid)
          n.note_uuid, n.instrument_uuid, n.watchlist_uuid
          FROM (
            (SELECT n_x_i.note_uuid, n_x_i.instrument_uuid, NULL watchlist_uuid
              FROM notes_x_instruments n_x_i
              JOIN notes n ON n.uuid = n_x_i.note_uuid
              WHERE n.created_by_user_uuid = $1::uuid)
            UNION ALL
            (SELECT n_x_i_x_w.note_uuid, n_x_i_x_w.instrument_uuid, n_x_i_x_w.watchlist_uuid
              FROM notes_x_instruments_x_watchlists n_x_i_x_w
              JOIN watchlist_user_permissions w ON w.watchlist_uuid = n_x_i_x_w.watchlist_uuid
              WHERE w.user_uuid = $1::uuid
              AND (w.permission_mask & B'00000011'::bit(8))::int != 0)) n
            WHERE n.instrument_uuid = $2::uuid
            ${ watchlist_uuid ? 'AND n.watchlist_uuid = $3::uuid' : '' }
          ORDER BY n.note_uuid, n.watchlist_uuid;
        `, 
        watchlist_uuid
          ? [context.claims.sub, connection.instrument_uuid, watchlist_uuid] 
          : [context.claims.sub, connection.instrument_uuid]);
        return res.rows.map(row => ({ ...row, type: "InstrumentNotesEdge" }));
    }
  },
  InstrumentNotesEdge: {
    cursor(edge, args, context, info) {
      return Buffer.from(`${edge.instrument_uuid},${edge.note_uuid}`).toString('base64');
    },
    async node(edge, args, context, info) {
      const res = await db.query(`
        SELECT n.*
          FROM notes n
          WHERE n.uuid = $1::uuid;
        `,
        [edge.note_uuid]);
      return { ...res.rows[0], type: "Note" };
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
          SELECT *
            FROM watchlist_user_permissions w
            WHERE w.user_uuid = $1::uuid
            ${ uuid ? 'AND w.uuid = $2::uuid' : '' };
          `, 
          uuid 
            ? [connection.user_uuid, uuid] 
            : [connection.user_uuid]);
        return res.rows.map(row => ({ ...row, type: "UserWatchlistsEdge" }));
      } 
      else
      {
        const res = await db.query(`
          SELECT DISTINCT ON (w.watchlist_uuid, w.user_uuid)
            w.watchlist_uuid, w.user_uuid, w.permission_mask
            FROM (
              (SELECT g_x_w.watchlist_uuid, u_x_g.user_uuid, u_x_g.permission_mask & g_x_w.permission_mask permission_mask
                FROM (
                  SELECT u_x_g.*
                    FROM users_x_groups u_x_g
                    JOIN users_x_groups my_u_x_g ON u_x_g.group_uuid = my_u_x_g.group_uuid
                    WHERE my_u_x_g.user_uuid = $2::uuid
                    AND (my_u_x_g.permission_mask & B'00000011'::bit(8))::int != 0
                  ) u_x_g
                JOIN groups_x_watchlists g_x_w ON u_x_g.group_uuid = g_x_w.group_uuid)
              UNION ALL
              (SELECT u_x_w.watchlist_uuid, u_x_w.user_uuid, u_x_w.permission_mask
                FROM users_x_watchlists u_x_w)) w
            JOIN (
              SELECT w.watchlist_uuid, w.user_uuid, w.permission_mask
                FROM watchlist_user_permissions w
                WHERE w.user_uuid = $2::uuid
              ) my_w ON w.watchlist_uuid = my_w.watchlist_uuid
            WHERE w.user_uuid = $1::uuid
            AND (my_w.permission_mask & B'00000011'::bit(8))::int != 0
            ${ uuid ? 'AND w.uuid = $3::uuid' : '' }
            ORDER BY w.watchlist_uuid, w.user_uuid, w.permission_mask DESC;
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
          FROM users u
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
  Note: {
    name(note, args, context, info) {
      return 'note';
    },
    async created_by(note, args, context, info) {
      const res = await db.query(`
        SELECT u.*
          FROM users u
          WHERE u.uuid = $1::uuid;
        `, 
        [note.created_by_user_uuid]);
      return res.rows[0];
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
    }
  })
};
