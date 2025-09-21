import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  remainingMinutes: integer("remaining_minutes").notNull(),
  deadline: timestamp("deadline"),
  mode: text("mode").notNull(), // 'professional' or 'private'
  status: text("status").notNull().default('pending'), // 'pending', 'active', 'completed'
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const accessTokens = pgTable("access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 64 }).notNull().unique(),
  permission: text("permission").notNull(), // 'read' or 'write'
  mode: text("mode").notNull(), // 'professional' or 'private'
  createdAt: timestamp("created_at").default(sql`now()`),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const updateTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertAccessTokenSchema = createInsertSchema(accessTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const createTokenRequestSchema = z.object({
  permission: z.enum(['read', 'write']),
  mode: z.enum(['professional', 'private']),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type AccessToken = typeof accessTokens.$inferSelect;
export type InsertAccessToken = z.infer<typeof insertAccessTokenSchema>;
export type CreateTokenRequest = z.infer<typeof createTokenRequestSchema>;

export const chunkTaskRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  mode: z.enum(['professional', 'private']),
});

export type ChunkTaskRequest = z.infer<typeof chunkTaskRequestSchema>;
