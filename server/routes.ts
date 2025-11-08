import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertReceiptSchema, 
  insertReceiptItemSchema, 
  insertPersonSchema,
  updateReceiptSchema,
  updateReceiptItemSchema,
  updatePersonSchema
} from "@shared/schema";
import { fromError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Receipt routes
  app.post("/api/receipts", async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse(req.body);
      const receipt = await storage.createReceipt(validatedData);
      res.json(receipt);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.get("/api/receipts", async (_req, res) => {
    try {
      const receipts = await storage.getAllReceipts();
      res.json(receipts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/receipts/:id", async (req, res) => {
    try {
      const validatedData = updateReceiptSchema.parse(req.body);
      const receipt = await storage.updateReceipt(req.params.id, validatedData);
      res.json(receipt);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      await storage.deleteReceipt(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Receipt Item routes
  app.post("/api/receipts/:receiptId/items", async (req, res) => {
    try {
      const validatedData = insertReceiptItemSchema.parse({
        ...req.body,
        receiptId: req.params.receiptId
      });
      const item = await storage.createReceiptItem(validatedData);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.get("/api/receipts/:receiptId/items", async (req, res) => {
    try {
      const items = await storage.getReceiptItems(req.params.receiptId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/items/:id", async (req, res) => {
    try {
      const validatedData = updateReceiptItemSchema.parse(req.body);
      const item = await storage.updateReceiptItem(req.params.id, validatedData);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      await storage.deleteReceiptItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // People routes
  app.post("/api/people", async (req, res) => {
    try {
      const validatedData = insertPersonSchema.parse(req.body);
      const person = await storage.createPerson(validatedData);
      res.json(person);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.get("/api/people", async (_req, res) => {
    try {
      const people = await storage.getAllPeople();
      res.json(people);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/people/regulars", async (_req, res) => {
    try {
      const regulars = await storage.getRegulars();
      res.json(regulars);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/people/:id", async (req, res) => {
    try {
      const validatedData = updatePersonSchema.parse(req.body);
      const person = await storage.updatePerson(req.params.id, validatedData);
      res.json(person);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.delete("/api/people/:id", async (req, res) => {
    try {
      await storage.deletePerson(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Share routes
  app.post("/api/receipts/:id/generate-share-token", async (req, res) => {
    try {
      const receipt = await storage.generateShareToken(req.params.id);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json({ shareToken: receipt.shareToken });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/share/:token", async (req, res) => {
    try {
      const receipt = await storage.getReceiptByShareToken(req.params.token);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      const items = await storage.getReceiptItems(receipt.id);
      const allPeople = await storage.getAllPeople();
      
      const assignedPersonIds = new Set<string>();
      items.forEach(item => {
        const assigned = (item.assignedTo as string[]) || [];
        assigned.forEach(id => assignedPersonIds.add(id));
      });
      
      const redactedPeople = allPeople
        .filter(person => assignedPersonIds.has(person.id))
        .map(person => ({
          id: person.id,
          name: person.name
        }));
      
      const redactedReceipt = {
        id: receipt.id,
        restaurantName: receipt.restaurantName,
        date: receipt.date,
        subtotal: receipt.subtotal,
        tax: receipt.tax,
        tip: receipt.tip,
        total: receipt.total,
        imageUrl: receipt.imageUrl
      };
      
      res.json({ receipt: redactedReceipt, items, people: redactedPeople });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
