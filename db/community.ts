import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";
import { users } from "./schema";
export const restaurants = sqliteTable("community_restaurants", {
  id: text("id").primaryKey(),
  key: text("identity_key").notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").references(() => users.id),
  createdAt: integer("created_at").notNull(),
  note: text("note").notNull().default(""),
});
export const posts = sqliteTable(
  "community_reviews",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    dishName: text("dish_name").notNull(),
    dishKey: text("dish_key").notNull(),
    price: real("price").notNull(),
    category: text("category").notNull(),
    experience: text("experience").notNull(),
    recommendation: integer("recommendation").notNull(),
    vlogUrl: text("vlog_url").notNull().default(""),
    images: text("images").notNull().default("[]"),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("community_reviews_restaurant_status").on(t.restaurantId, t.status),
    index("community_reviews_author").on(t.userId),
  ],
);
export const userFollows = sqliteTable(
  "community_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetId] })],
);
export const likes = sqliteTable(
  "community_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reviewId: text("review_id")
      .notNull()
      .references(() => posts.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reviewId] })],
);
export const saves = sqliteTable(
  "community_saves",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reviewId: text("review_id")
      .notNull()
      .references(() => posts.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reviewId] })],
);
export const outings = sqliteTable("community_outings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  stops: text("stops").notNull().default("[]"),
  revision: integer("revision").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const images = sqliteTable("community_images", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  mime: text("mime").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const profiles = sqliteTable("community_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  bannerId: text("banner_id").references(() => images.id),
});
export const reports = sqliteTable(
  "community_reports",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reviewId: text("review_id")
      .notNull()
      .references(() => posts.id),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
    handledAt: integer("handled_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.reviewId] }),
    index("community_reports_queue").on(t.reviewId, t.handledAt),
  ],
);
