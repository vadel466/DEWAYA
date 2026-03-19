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
  b2bEnabled: boolean("b2b_enabled").notNull().default(false),
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
  pharmacyId: text("pharmacy_id"),
  pharmacyName: text("pharmacy_name").notNull(),
  pharmacyAddress: text("pharmacy_address").notNull(),
  pharmacyPhone: text("pharmacy_phone").notNull(),
  status: text("status").notNull().default("available"),
  adminStatus: text("admin_status").notNull().default("pending_admin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPharmacyResponseSchema = createInsertSchema(pharmacyResponsesTable).omit({ createdAt: true });
export type InsertPharmacyResponse = z.infer<typeof insertPharmacyResponseSchema>;
export type PharmacyResponse = typeof pharmacyResponsesTable.$inferSelect;

export const dutyImagesTable = pgTable("duty_images", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  imageData: text("image_data").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  caption: text("caption"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertDutyImageSchema = createInsertSchema(dutyImagesTable).omit({ uploadedAt: true });
export type InsertDutyImage = z.infer<typeof insertDutyImageSchema>;
export type DutyImage = typeof dutyImagesTable.$inferSelect;

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

export const pharmacyInventoryTable = pgTable("pharmacy_inventory", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull(),
  pharmacyName: text("pharmacy_name").notNull(),
  pharmacyAddress: text("pharmacy_address").notNull(),
  pharmacyPhone: text("pharmacy_phone").notNull(),
  drugName: text("drug_name").notNull(),
  drugNameLower: text("drug_name_lower").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPharmacyInventorySchema = createInsertSchema(pharmacyInventoryTable).omit({ createdAt: true });
export type InsertPharmacyInventory = z.infer<typeof insertPharmacyInventorySchema>;
export type PharmacyInventory = typeof pharmacyInventoryTable.$inferSelect;

export const b2bMessagesTable = pgTable("b2b_messages", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull(),
  pharmacyName: text("pharmacy_name").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("order"),
  adminStatus: text("admin_status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertB2bMessageSchema = createInsertSchema(b2bMessagesTable).omit({ createdAt: true });
export type InsertB2bMessage = z.infer<typeof insertB2bMessageSchema>;
export type B2bMessage = typeof b2bMessagesTable.$inferSelect;

export const doctorsTable = pgTable("doctors", {
  id: text("id").primaryKey(),
  doctorName: text("doctor_name").notNull(),
  doctorNameAr: text("doctor_name_ar"),
  specialty: text("specialty"),
  specialtyAr: text("specialty_ar"),
  clinicName: text("clinic_name").notNull(),
  clinicNameAr: text("clinic_name_ar"),
  address: text("address").notNull(),
  addressAr: text("address_ar"),
  phone: text("phone").notNull(),
  scheduleText: text("schedule_text"),
  scheduleAr: text("schedule_ar"),
  imageData: text("image_data"),
  imageMimeType: text("image_mime_type"),
  region: text("region"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ createdAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;
