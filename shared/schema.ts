import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantName: text("restaurant_name"),
  date: timestamp("date").notNull().defaultNow(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull(),
  tip: numeric("tip", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
});

export const receiptItems = pgTable("receipt_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").notNull().references(() => receipts.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  assignedTo: jsonb("assigned_to").$type<string[]>().default([]),
});

export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  isRegular: integer("is_regular").notNull().default(0),
});

const numericStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid numeric string");

export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true });
export const insertReceiptItemSchema = createInsertSchema(receiptItems).omit({ id: true });
export const insertPersonSchema = createInsertSchema(people).omit({ id: true });

export const updateReceiptSchema = z.object({
  restaurantName: z.string().optional(),
  subtotal: numericStringSchema.optional(),
  tax: numericStringSchema.optional(),
  tip: numericStringSchema.optional(),
  total: numericStringSchema.optional(),
  imageUrl: z.string().optional(),
}).strict();

export const updateReceiptItemSchema = z.object({
  name: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  price: numericStringSchema.optional(),
  assignedTo: z.array(z.string()).optional(),
}).strict();

export const updatePersonSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isRegular: z.number().int().min(0).max(1).optional(),
}).strict();

export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertReceiptItem = z.infer<typeof insertReceiptItemSchema>;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof people.$inferSelect;
