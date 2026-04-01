import { 
  type Receipt, 
  type InsertReceipt, 
  type ReceiptItem,
  type InsertReceiptItem,
  type Person,
  type InsertPerson,
  type ReceiptPerson,
  type InsertReceiptPerson,
  type Payment,
  type InsertPayment,
  type User,
  receipts,
  receiptItems,
  people,
  receiptPeople,
  payments,
  users,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, or } from "drizzle-orm";

export interface IStorage {
  // Auth / User operations
  createUser(email: string, passwordHash: string, name: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;

  // Receipt operations
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  getAllReceipts(userId: string): Promise<Receipt[]>;
  updateReceipt(id: string, receipt: Partial<InsertReceipt>): Promise<Receipt>;
  deleteReceipt(id: string): Promise<void>;
  generateShareToken(id: string): Promise<Receipt | undefined>;
  getReceiptByShareToken(token: string): Promise<Receipt | undefined>;

  // Receipt Item operations
  createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem>;
  getReceiptItems(receiptId: string): Promise<ReceiptItem[]>;
  updateReceiptItem(id: string, item: Partial<InsertReceiptItem>): Promise<ReceiptItem>;
  deleteReceiptItem(id: string): Promise<void>;
  clearReceiptItems(receiptId: string): Promise<void>;

  // People operations
  createPerson(person: InsertPerson): Promise<Person>;
  getPerson(id: string): Promise<Person | undefined>;
  getAllPeople(userId: string): Promise<Person[]>;
  getRegulars(userId: string): Promise<Person[]>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person>;
  deletePerson(id: string): Promise<void>;

  // Receipt People operations
  addPersonToReceipt(receiptId: string, personId: string): Promise<ReceiptPerson>;
  removePersonFromReceipt(receiptId: string, personId: string): Promise<void>;
  getReceiptPeople(receiptId: string): Promise<Person[]>;

  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayments(receiptId: string): Promise<Payment[]>;
  deletePayment(id: string): Promise<void>;
  calculateSettlement(receiptId: string): Promise<Array<{ from: Person; to: Person; amount: string }>>;
}

export class DatabaseStorage implements IStorage {
  // Auth / User operations
  async createUser(email: string, passwordHash: string, name: string): Promise<User> {
    const [result] = await db.insert(users).values({ email, passwordHash, name }).returning();
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  }

  // Receipt operations
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [result] = await db.insert(receipts).values(receipt).returning();
    return result;
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const [result] = await db.select().from(receipts).where(eq(receipts.id, id));
    return result;
  }

  async getAllReceipts(userId: string): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(eq(receipts.userId, userId))
      .orderBy(receipts.date);
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
    await db.delete(payments).where(eq(payments.receiptId, id));
    await db.delete(receiptPeople).where(eq(receiptPeople.receiptId, id));
    await db.delete(receiptItems).where(eq(receiptItems.receiptId, id));
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

  async clearReceiptItems(receiptId: string): Promise<void> {
    await db.delete(receiptItems).where(eq(receiptItems.receiptId, receiptId));
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

  async getAllPeople(userId: string): Promise<Person[]> {
    return await db
      .select()
      .from(people)
      .where(eq(people.userId, userId));
  }

  async getRegulars(userId: string): Promise<Person[]> {
    return await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.isRegular, 1)));
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

  // Receipt People operations
  async addPersonToReceipt(receiptId: string, personId: string): Promise<ReceiptPerson> {
    const [result] = await db
      .insert(receiptPeople)
      .values({ receiptId, personId })
      .returning();
    return result;
  }

  async removePersonFromReceipt(receiptId: string, personId: string): Promise<void> {
    const items = await db
      .select()
      .from(receiptItems)
      .where(eq(receiptItems.receiptId, receiptId));
    
    const hasAssignedItems = items.some(item => 
      (item.assignedTo as string[] || []).includes(personId)
    );
    
    if (hasAssignedItems) {
      throw new Error("Cannot remove person who has items assigned on this receipt");
    }
    
    await db
      .delete(receiptPeople)
      .where(
        and(
          eq(receiptPeople.receiptId, receiptId),
          eq(receiptPeople.personId, personId)
        )
      );
  }

  async getReceiptPeople(receiptId: string): Promise<Person[]> {
    const result = await db
      .select({
        id: people.id,
        userId: people.userId,
        name: people.name,
        phone: people.phone,
        email: people.email,
        venmoUsername: people.venmoUsername,
        isRegular: people.isRegular
      })
      .from(receiptPeople)
      .innerJoin(people, eq(receiptPeople.personId, people.id))
      .where(eq(receiptPeople.receiptId, receiptId));
    
    return result;
  }

  // Payment operations
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [result] = await db.insert(payments).values(payment).returning();
    return result;
  }

  async getPayments(receiptId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.receiptId, receiptId));
  }

  async deletePayment(id: string): Promise<void> {
    await db.delete(payments).where(eq(payments.id, id));
  }

  async calculateSettlement(receiptId: string): Promise<Array<{ from: Person; to: Person; amount: string }>> {
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    const items = await this.getReceiptItems(receiptId);
    const receiptPayments = await this.getPayments(receiptId);
    const receiptPeopleList = await this.getReceiptPeople(receiptId);

    const owedByPerson = new Map<string, number>();
    receiptPeopleList.forEach(person => {
      owedByPerson.set(person.id, 0);
    });

    const subtotalNum = parseFloat(receipt.subtotal);
    const taxNum = parseFloat(receipt.tax);
    const tipNum = parseFloat(receipt.tip);

    items.forEach(item => {
      const assignedTo = (item.assignedTo as string[]) || [];
      if (assignedTo.length > 0) {
        const itemPrice = parseFloat(item.price) * item.quantity;
        const pricePerPerson = itemPrice / assignedTo.length;
        assignedTo.forEach(personId => {
          const current = owedByPerson.get(personId) || 0;
          owedByPerson.set(personId, current + pricePerPerson);
        });
      }
    });

    const taxTipMultiplier = subtotalNum > 0 ? (taxNum + tipNum) / subtotalNum : 0;
    owedByPerson.forEach((subtotal, personId) => {
      owedByPerson.set(personId, subtotal + subtotal * taxTipMultiplier);
    });

    const paidByPerson = new Map<string, number>();
    receiptPeopleList.forEach(person => {
      paidByPerson.set(person.id, 0);
    });
    receiptPayments.forEach(payment => {
      const current = paidByPerson.get(payment.personId) || 0;
      paidByPerson.set(payment.personId, current + parseFloat(payment.amount));
    });

    const balances = new Map<string, number>();
    receiptPeopleList.forEach(person => {
      const owed = owedByPerson.get(person.id) || 0;
      const paid = paidByPerson.get(person.id) || 0;
      balances.set(person.id, paid - owed);
    });

    const settlements: Array<{ from: Person; to: Person; amount: string }> = [];
    const creditors: Array<{ person: Person; amount: number }> = [];
    const debtors: Array<{ person: Person; amount: number }> = [];

    balances.forEach((balance, personId) => {
      const person = receiptPeopleList.find(p => p.id === personId);
      if (!person) return;
      if (balance > 0.01) {
        creditors.push({ person, amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ person, amount: -balance });
      }
    });

    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const settlementAmount = Math.min(creditor.amount, debtor.amount);
      if (settlementAmount > 0.01) {
        settlements.push({
          from: debtor.person,
          to: creditor.person,
          amount: settlementAmount.toFixed(2)
        });
      }
      creditor.amount -= settlementAmount;
      debtor.amount -= settlementAmount;
      if (creditor.amount < 0.01) creditorIndex++;
      if (debtor.amount < 0.01) debtorIndex++;
    }

    return settlements;
  }
}

export const storage = new DatabaseStorage();
