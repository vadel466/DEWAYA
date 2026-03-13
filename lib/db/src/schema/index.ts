import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const drugRequestsTable = pgTable("drug_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  drugName: text("drug_name").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  pharmacyName: text("pharmacy_name"),
  pharmacyAddress: text("pharmacy_address"),
  pharmacyPhone: text("pharmacy_phone"),
});

export const insertDrugRequestSchema = createInsertSchema(drugRequestsTable).omit({ createdAt: true, respondedAt: true });
export type InsertDrugRequest = z.infer<typeof insertDrugRequestSchema>;
export type DrugRequest = typeof drugRequestsTable.$inferSelect;

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  requestId: text("request_id").notNull(),
  pharmacyName: text("pharmacy_name").notNull(),
  pharmacyAddress: text("pharmacy_address").notNull(),
  pharmacyPhone: text("pharmacy_phone").notNull(),
  isLocked: boolean("is_locked").notNull().default(true),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
