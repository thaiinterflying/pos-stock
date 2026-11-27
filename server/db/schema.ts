import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'STAFF']);

export const movementTypeEnum = pgEnum('movement_type', ['OPENING', 'IN', 'OUT', 'ADJUSTMENT']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('STAFF'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_role_active_idx').on(table.role, table.isActive),
    check('users_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check('users_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('categories_name_lower_idx').on(sql`lower(${table.name})`),
    check('categories_name_not_blank', sql`length(btrim(${table.name})) > 0`),
  ],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    unit: text('unit').notNull(),
    currentStock: integer('current_stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(0),
    storageLocation: text('storage_location'),
    description: text('description'),
    /** object key ใน Neon Object Storage (bucket private) — null = ไม่มีรูป */
    imageKey: text('image_key'),
    imageUpdatedAt: timestamp('image_updated_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('products_category_idx').on(table.categoryId),
    index('products_active_idx').on(table.isActive),
    index('products_name_idx').on(table.name),
    check('products_current_stock_non_negative', sql`${table.currentStock} >= 0`),
    check('products_min_stock_non_negative', sql`${table.minStock} >= 0`),
    check('products_sku_not_blank', sql`length(btrim(${table.sku})) > 0`),
    check('products_name_not_blank', sql`length(btrim(${table.name})) > 0`),
  ],
);

/**
 * ประวัติการเคลื่อนไหวของสต๊อก — append-only
 * ห้าม UPDATE/DELETE ผ่านแอป และ FK เป็น RESTRICT เพื่อไม่ให้ประวัติกำพร้า
 */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    type: movementTypeEnum('type').notNull(),
    quantityChange: integer('quantity_change').notNull(),
    quantityBefore: integer('quantity_before').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    recipientName: text('recipient_name'),
    department: text('department'),
    note: text('note'),
    performedBy: uuid('performed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** idempotency key กันการบันทึกซ้ำจาก double submit */
    requestId: uuid('request_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('stock_movements_product_created_idx').on(table.productId, table.createdAt.desc()),
    index('stock_movements_created_idx').on(table.createdAt.desc()),
    index('stock_movements_type_created_idx').on(table.type, table.createdAt.desc()),
    index('stock_movements_performed_by_idx').on(table.performedBy),
    check('stock_movements_quantity_change_non_zero', sql`${table.quantityChange} <> 0`),
    check(
      'stock_movements_balance_consistent',
      sql`${table.quantityAfter} = ${table.quantityBefore} + ${table.quantityChange}`,
    ),
    check(
      'stock_movements_quantities_non_negative',
      sql`${table.quantityBefore} >= 0 and ${table.quantityAfter} >= 0`,
    ),
    check(
      'stock_movements_direction_valid',
      sql`(${table.type} = 'OUT' and ${table.quantityChange} < 0)
        or (${table.type} in ('IN', 'OPENING') and ${table.quantityChange} > 0)
        or (${table.type} = 'ADJUSTMENT' and ${table.quantityChange} <> 0)`,
    ),
    check(
      'stock_movements_out_requires_recipient',
      sql`${table.type} <> 'OUT' or (${table.recipientName} is not null and length(btrim(${table.recipientName})) > 0)`,
    ),
    check(
      'stock_movements_adjustment_requires_note',
      sql`${table.type} <> 'ADJUSTMENT' or (${table.note} is not null and length(btrim(${table.note})) > 0)`,
    ),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => [
    index('sessions_user_idx').on(table.userId),
    index('sessions_expires_idx').on(table.expiresAt),
  ],
);

/** บันทึกความพยายามเข้าสู่ระบบเพื่อป้องกัน brute force (เก็บ hash ของอีเมลเท่านั้น) */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailHash: text('email_hash').notNull(),
    ip: text('ip'),
    succeeded: boolean('succeeded').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('login_attempts_email_created_idx').on(table.emailHash, table.createdAt),
    index('login_attempts_ip_created_idx').on(table.ip, table.createdAt),
  ],
);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type MovementType = (typeof movementTypeEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Session = typeof sessions.$inferSelect;
