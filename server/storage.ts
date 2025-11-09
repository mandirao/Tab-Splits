import { 
  type Receipt, 
  type InsertReceipt, 
  type ReceiptItem,
  type InsertReceiptItem,
  type Person,
  type InsertPerson,
  receipts,
  receiptItems,
  people
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Receipt operations
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  getAllReceipts(): Promise<Receipt[]>;
  updateReceipt(id: string, receipt: Partial<InsertReceipt>): Promise<Receipt>;
  deleteReceipt(id: string): Promise<void>;
  generateShareToken(id: string): Promise<Receipt | undefined>;
  getReceiptByShareToken(token: string): Promise<Receipt | undefined>;

  // Receipt Item operations
  createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem>;
  getReceiptItems(receiptId: string): Promise<ReceiptItem[]>;
  updateReceiptItem(id: string, item: Partial<InsertReceiptItem>): Promise<ReceiptItem>;
  deleteReceiptItem(id: string): Promise<void>;

  // People operations
  createPerson(person: InsertPerson): Promise<Person>;
  getPerson(id: string): Promise<Person | undefined>;
  getAllPeople(): Promise<Person[]>;
  getRegulars(): Promise<Person[]>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person>;
  deletePerson(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Receipt operations
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [result] = await db.insert(receipts).values(receipt).returning();
    return result;
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [result] = await db.select().from(receipts).where(eq(receipts.id, id));
    return result;
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return await db.select().from(receipts).orderBy(receipts.date);
  }

  async updateReceipt(id: string, receipt: Partial<InsertReceipt>): Promise<Receipt> {
    const [result] = await db
      .update(receipts)
      .set(receipt)
      .where(eq(receipts.id, id))
      .returning();
    return result;
  }

  async deleteReceipt(id: string): Promise<void> {
    await db.delete(receipts).where(eq(receipts.id, id));
  }

  async generateShareToken(id: string): Promise<Receipt | undefined> {
    const shareToken = crypto.randomUUID();
    const [result] = await db
      .update(receipts)
      .set({ shareToken })
      .where(eq(receipts.id, id))
      .returning();
    return result;
  }

  async getReceiptByShareToken(token: string): Promise<Receipt | undefined> {
    const [result] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.shareToken, token));
    return result;
  }

  // Receipt Item operations
  async createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem> {
    const [result] = await db.insert(receiptItems).values(item as any).returning();
    return result;
  }

  async getReceiptItems(receiptId: string): Promise<ReceiptItem[]> {
    return await db
      .select()
      .from(receiptItems)
      .where(eq(receiptItems.receiptId, receiptId));
  }

  async updateReceiptItem(id: string, item: Partial<InsertReceiptItem>): Promise<ReceiptItem> {
    const existing = await db.select().from(receiptItems).where(eq(receiptItems.id, id)).limit(1);
    if (!existing.length) {
      throw new Error("Item not found");
    }
    
    const updateData: any = {
      ...item,
      assignedTo: item.assignedTo !== undefined ? item.assignedTo : existing[0].assignedTo
    };
    
    const [result] = await db
      .update(receiptItems)
      .set(updateData)
      .where(eq(receiptItems.id, id))
      .returning();
    return result;
  }

  async deleteReceiptItem(id: string): Promise<void> {
    await db.delete(receiptItems).where(eq(receiptItems.id, id));
  }

  // People operations
  async createPerson(person: InsertPerson): Promise<Person> {
    const [result] = await db.insert(people).values(person).returning();
    return result;
  }

  async getPerson(id: string): Promise<Person | undefined> {
    const [result] = await db.select().from(people).where(eq(people.id, id));
    return result;
  }

  async getAllPeople(): Promise<Person[]> {
    return await db.select().from(people);
  }

  async getRegulars(): Promise<Person[]> {
    return await db.select().from(people).where(eq(people.isRegular, 1));
  }

  async updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person> {
    const [result] = await db
      .update(people)
      .set(person)
      .where(eq(people.id, id))
      .returning();
    return result;
  }

  async deletePerson(id: string): Promise<void> {
    const items = await db.select().from(receiptItems);
    const hasAssignedItems = items.some(item => 
      (item.assignedTo as string[] || []).includes(id)
    );
    
    if (hasAssignedItems) {
      throw new Error("Cannot delete person who has items assigned to them");
    }
    
    await db.delete(people).where(eq(people.id, id));
  }
}

export const storage = new DatabaseStorage();
