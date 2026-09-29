import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sellers = sqliteTable('sellers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  storeSlug: text('store_slug').notNull().default(''),
  plan: text('plan').notNull().default('free'),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  sellerId: text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('idx_sessions_seller').on(table.sellerId)]);

export const passwordResets = sqliteTable('password_resets', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('idx_password_resets_seller').on(table.sellerId)]);

export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  mileage: integer('mileage').notNull(),
  price: integer('price').notNull(),
  location: text('location').notNull(),
  image: text('image'),
  description: text('description'),
  whatsapp: text('whatsapp').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_listings_recent').on(table.createdAt),
  index('idx_listings_make').on(table.make),
  index('idx_listings_seller').on(table.sellerId),
]);

export const listingMetrics = sqliteTable('listing_metrics', {
  listingId: text('listing_id').primaryKey().references(() => listings.id, { onDelete: 'cascade' }),
  views: integer('views').notNull().default(0),
  whatsappClicks: integer('whatsapp_clicks').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});
