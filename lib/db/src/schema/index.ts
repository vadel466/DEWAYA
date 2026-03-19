import { pgTable, text, boolean, timestamp, real, integer } from "drizzle-orm/pg-core";
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
  paymentPending: boolean("payment_pending").notNull().default(false),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

export const pharmaciesTable = pgTable("pharmacies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  address: text("address").notNull(),
  addressAr: text("address_ar"),
  phone: text("phone").notNull(),
  lat: real("lat"),
  lon: real("lon"),
  region: text("region"),
  portalPin: text("portal_pin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPharmacySchema = createInsertSchema(pharmaciesTable).omit({ createdAt: true });
export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;
export type Pharmacy = typeof pharmaciesTable.$inferSelect;

export const dutyPharmaciesTable = pgTable("duty_pharmacies", {
  id: text("id").primaryKey(),
  pharmacyName: text("pharmacy_name").notNull(),
  pharmacyAddress: text("pharmacy_address").notNull(),
  pharmacyPhone: text("pharmacy_phone").notNull(),
  region: text("region").notNull(),
  date: text("date").notNull(),
  scheduleText: text("schedule_text"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDutyPharmacySchema = createInsertSchema(dutyPharmaciesTable).omit({ createdAt: true });
export type InsertDutyPharmacy = z.infer<typeof insertDutyPharmacySchema>;
export type DutyPharmacy = typeof dutyPharmaciesTable.$inferSelect;

export const pharmacyResponsesTable = pgTable("pharmacy_responses", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  pharmacyName: text("pharmacy_name").notNull(),
  pharmacyAddress: text("pharmacy_address").notNull(),
  pharmacyPhone: text("pharmacy_phone").notNull(),
  status: text("status").notNull().default("available"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPharmacyResponseSchema = createInsertSchema(pharmacyResponsesTable).omit({ createdAt: true });
export type InsertPharmacyResponse = z.infer<typeof insertPharmacyResponseSchema>;
export type PharmacyResponse = typeof pharmacyResponsesTable.$inferSelect;

export const drugPricesTable = pgTable("drug_prices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  nameLower: text("name_lower").notNull(),
  price: real("price").notNull(),
  unit: text("unit"),
  category: text("category"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDrugPriceSchema = createInsertSchema(drugPricesTable).omit({ createdAt: true, updatedAt: true });
export type InsertDrugPrice = z.infer<typeof insertDrugPriceSchema>;
export type DrugPrice = typeof drugPricesTable.$inferSelect;
