import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  restaurantName: text("restaurant_name"),
  date: timestamp("date").notNull().defaultNow(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull(),
  tip: numeric("tip", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  shareToken: varchar("share_token").unique(),
  paidById: varchar("paid_by_id"),
  diningFormat: text("dining_format"),
});

export const receiptItems = pgTable("receipt_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").notNull().references(() => receipts.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  assignedTo: jsonb("assigned_to").$type<string[]>().default([]),
  assignedQuantities: jsonb("assigned_quantities").$type<Record<string, number>>().default({}),
  category: text("category"),
});

export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  venmoUsername: text("venmo_username"),
  isRegular: integer("is_regular").notNull().default(0),
});

export const receiptPeople = pgTable("receipt_people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").notNull().references(() => receipts.id),
  personId: varchar("person_id").notNull().references(() => people.id),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").notNull().references(() => receipts.id),
  personId: varchar("person_id").notNull().references(() => people.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const numericStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid numeric string");

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true });
export const insertReceiptItemSchema = createInsertSchema(receiptItems).omit({ id: true });
export const insertPersonSchema = createInsertSchema(people).omit({ id: true });
export const insertReceiptPersonSchema = createInsertSchema(receiptPeople).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });

export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateReceiptSchema = z.object({
  restaurantName: z.string().optional(),
  subtotal: numericStringSchema.optional(),
  tax: numericStringSchema.optional(),
  tip: numericStringSchema.optional(),
  total: numericStringSchema.optional(),
  imageUrl: z.string().optional(),
  paidById: z.string().nullable().optional(),
  diningFormat: z.enum(["family", "courses", "mixed"]).nullable().optional(),
}).strict();

export const updateReceiptItemSchema = z.object({
  name: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  price: numericStringSchema.optional(),
  assignedTo: z.array(z.string()).optional(),
  assignedQuantities: z.record(z.string(), z.number()).optional(),
  category: z.enum(["appetizer", "meal", "drink", "dessert", "other"]).nullable().optional(),
}).strict();

export const updatePersonSchema = z.object({
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().optional(),
  venmoUsername: z.string().nullable().optional(),
  isRegular: z.number().int().min(0).max(1).optional(),
}).strict();

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertReceiptItem = z.infer<typeof insertReceiptItemSchema>;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof people.$inferSelect;
export type InsertReceiptPerson = z.infer<typeof insertReceiptPersonSchema>;
export type ReceiptPerson = typeof receiptPeople.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
