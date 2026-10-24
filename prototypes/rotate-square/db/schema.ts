import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), state: text('state').notNull(), version: integer('version').notNull().default(0),
  redToken: text('red_token').notNull(), blueToken: text('blue_token'), createdAt: integer('created_at').notNull(),
});
