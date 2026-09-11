import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  real,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  role: text("role").notNull().default("user"),
  location: text("location").notNull().default("72 Outer Circle, New York"),
  createdAt: integer("created_at").notNull(),
});
export const localAccounts = sqliteTable('local_accounts', {
  userId: text('user_id').primaryKey().references(() => users.id),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  verified: integer('verified').notNull().default(0),
});
export const localSessions = sqliteTable('local_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
});
export const localOtp = sqliteTable('local_otp', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  purpose: text('purpose').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  sentAt: integer('sent_at').notNull(),
}, t => [uniqueIndex('local_otp_user_purpose').on(t.userId,t.purpose)]);
export const localNewsletter = sqliteTable('local_newsletter', {
  email: text('email').primaryKey(),
  createdAt: integer('created_at').notNull(),
});
export const creators = sqliteTable(
  "creators",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").references(() => users.id),
    status: text("status").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("creator_owner").on(t.ownerId)],
);
export const dishes = sqliteTable(
  "dishes",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").references(() => creators.id),
    status: text("status").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("dish_status").on(t.status)],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    text: text("text").notNull(),
    recommendation: text("recommendation").notNull(),
    status: text("status").notNull().default("published"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("review_user_dish").on(t.userId, t.dishId),
    index("review_dish_status").on(t.dishId, t.status),
  ],
);
export const saved = sqliteTable(
  "saved",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dishId] })],
);
export const follows = sqliteTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creators.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.creatorId] })],
);
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    planId: text("plan_id").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    mode: text("mode").notNull().default("test"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("order_idempotency").on(t.userId, t.idempotencyKey),
    index("order_user").on(t.userId),
  ],
);
export const entitlements = sqliteTable(
  "entitlements",
  {
    orderId: text("order_id")
      .primaryKey()
      .references(() => orders.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revoked: integer("revoked").notNull().default(0),
    mode: text("mode").notNull().default("test"),
  },
  (t) => [index("entitlement_user").on(t.userId, t.expiresAt)],
);
export const paymentEvents = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  type: text("type").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const limits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
