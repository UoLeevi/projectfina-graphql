import db from '../db';

export default {
  Query: {
    async markets(parent, args, context, info) {
      const res = await db.query(`
        SELECT m.* 
          FROM markets m;
      `);
      return res.rows;
    },
    async me(parent, args, context, info) {
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
    async instruments({ uuid }, args, context, info) {
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
    async market({ market_uuid }, args, context, info) {
      const res = await db.query(`
        SELECT m.*
          FROM markets m
          WHERE m.uuid = $1::uuid;
      `, 
      [market_uuid]);
      return res.rows[0];
    }
  },
  User: {

  }
};
