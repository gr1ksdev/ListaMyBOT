import { table, integer, text } from 'sdk/db';
export const settings = table('list_settings', { id: integer('id').primaryKey(), value: text('value').notNull(), version: integer('version').notNull().default(1) });
export const chats = table('list_chats', {
 id: integer('id').primaryKey(), title: text('title').notNull(), type: text('type').notNull(), url: text('url').notNull().default(''),
 category: integer('category').notNull().default(-1), status: text('status').notNull().default('draft'), owner: integer('owner').notNull(),
 display: text('display').notNull().default(''), position: integer('position').notNull().default(0), menu_chat: integer('menu_chat'), menu_id: integer('menu_id'),
 last_messages: text('last_messages').notNull().default('[]'), error: text('error').notNull().default(''), updated: integer('updated').notNull()
});
export const rounds = table('list_rounds', { id: text('id').primaryKey(), created: integer('created').notNull(), content: text('content').notNull(), status: text('status').notNull().default('active') });
export const ads = table('list_ads', {
 id: integer('id').primaryKey(), title: text('title').notNull(), url: text('url').notNull().default(''),
 slot_row: integer('slot_row').notNull().default(0), slot_col: integer('slot_col').notNull().default(0),
 style: text('style').notNull().default(''), updated: integer('updated').notNull()
});
export const deliveries = table('list_deliveries', {
 id: text('id').primaryKey(), round: text('round').notNull(), chat: integer('chat').notNull(), status: text('status').notNull().default('pending'),
 page: integer('page').notNull().default(0), messages: text('messages').notNull().default('[]'), attempts: integer('attempts').notNull().default(0), available: integer('available').notNull().default(0), error: text('error').notNull().default('')
});
export const runtime = table('list_runtime', { id: text('id').primaryKey(), value: text('value').notNull() });
export const promotions = table('list_promotions', {
  id: text('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  user_name: text('user_name').notNull().default(''),
  type: text('type').notNull().default('channel'),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default(''),
  url: text('url').notNull(),
  media_type: text('media_type').notNull().default(''),
  media_file_id: text('media_file_id').notNull().default(''),
  status: text('status').notNull().default('pending'),
  log_chat_id: integer('log_chat_id'),
  log_message_id: integer('log_message_id'),
  channel_message_id: integer('channel_message_id'),
  created: integer('created').notNull(),
  reviewed_by: integer('reviewed_by'),
  reviewed_at: integer('reviewed_at')
});
