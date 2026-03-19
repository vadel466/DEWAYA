import { pgTable, text, boolean, timestamp, real, integer, index } from "drizzle-orm/pg-core";
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
}, (table) => [
  index("drug_requests_user_id_idx").on(table.userId),
  index("drug_requests_status_idx").on(table.status),
  index("drug_requests_created_at_idx").on(table.createdAt),
  index("drug_requests_user_status_idx").on(table.userId, table.status),
]);

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
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_request_id_idx").on(table.requestId),
  index("notifications_payment_pending_idx").on(table.paymentPending),
  index("notifications_user_read_idx").on(table.userId, table.isRead),
]);

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
  subscriptionActive: boolean("subscription_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("pharmacies_region_idx").on(table.region),
  index("pharmacies_is_active_idx").on(table.isActive),
  index("pharmacies_region_active_idx").on(table.region, table.isActive),
]);

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
}, (table) => [
  index("duty_pharmacies_region_idx").on(table.region),
  index("duty_pharmacies_date_idx").on(table.date),
  index("duty_pharmacies_region_date_idx").on(table.region, table.date),
  index("duty_pharmacies_is_active_idx").on(table.isActive),
]);

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
}, (table) => [
  index("pharmacy_responses_request_id_idx").on(table.requestId),
  index("pharmacy_responses_admin_status_idx").on(table.adminStatus),
  index("pharmacy_responses_pharmacy_id_idx").on(table.pharmacyId),
]);

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
}, (table) => [
  index("duty_images_region_idx").on(table.region),
  index("duty_images_is_active_idx").on(table.isActive),
]);

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
}, (table) => [
  index("drug_prices_name_lower_idx").on(table.nameLower),
  index("drug_prices_is_active_idx").on(table.isActive),
  index("drug_prices_category_idx").on(table.category),
]);

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
}, (table) => [
  index("pharmacy_inventory_drug_name_lower_idx").on(table.drugNameLower),
  index("pharmacy_inventory_pharmacy_id_idx").on(table.pharmacyId),
  index("pharmacy_inventory_is_active_idx").on(table.isActive),
]);

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
}, (table) => [
  index("b2b_messages_pharmacy_id_idx").on(table.pharmacyId),
  index("b2b_messages_admin_status_idx").on(table.adminStatus),
]);

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
}, (table) => [
  index("doctors_region_idx").on(table.region),
  index("doctors_is_active_idx").on(table.isActive),
  index("doctors_specialty_idx").on(table.specialty),
]);

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ createdAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;

export const companiesTable = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  code: text("code").notNull(),
  contact: text("contact"),
  subscriptionActive: boolean("subscription_active").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("companies_is_active_idx").on(table.isActive),
]);

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;

export const companyOrdersTable = pgTable("company_orders", {
  id: text("id").primaryKey(),
  pharmacyId: text("pharmacy_id").notNull(),
  pharmacyName: text("pharmacy_name").notNull(),
  companyId: text("company_id"),
  companyName: text("company_name"),
  drugName: text("drug_name").notNull(),
  quantity: text("quantity"),
  message: text("message"),
  type: text("type").notNull().default("order"),
  status: text("status").notNull().default("pending"),
  companyResponse: text("company_response"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("company_orders_pharmacy_id_idx").on(table.pharmacyId),
  index("company_orders_company_id_idx").on(table.companyId),
  index("company_orders_status_idx").on(table.status),
]);

export const insertCompanyOrderSchema = createInsertSchema(companyOrdersTable).omit({ createdAt: true, respondedAt: true });
export type InsertCompanyOrder = z.infer<typeof insertCompanyOrderSchema>;
export type CompanyOrder = typeof companyOrdersTable.$inferSelect;

export const companyInventoryTable = pgTable("company_inventory", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  companyName: text("company_name").notNull(),
  drugName: text("drug_name").notNull(),
  drugNameLower: text("drug_name_lower").notNull(),
  price: real("price"),
  unit: text("unit"),
  notes: text("notes"),
  isAd: boolean("is_ad").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("company_inventory_drug_name_lower_idx").on(table.drugNameLower),
  index("company_inventory_company_id_idx").on(table.companyId),
  index("company_inventory_is_active_idx").on(table.isActive),
]);

export const insertCompanyInventorySchema = createInsertSchema(companyInventoryTable).omit({ createdAt: true });
export type InsertCompanyInventory = z.infer<typeof insertCompanyInventorySchema>;
export type CompanyInventory = typeof companyInventoryTable.$inferSelect;
