import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertReceiptSchema, 
  insertReceiptItemSchema, 
  insertPersonSchema,
  insertPaymentSchema,
  updateReceiptSchema,
  updateReceiptItemSchema,
  updatePersonSchema
} from "@shared/schema";
import { fromError } from "zod-validation-error";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Receipt scanning with OpenAI Vision
  app.post("/api/scan-receipt", async (req, res) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({ message: "No image provided" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this restaurant receipt image and extract the following information in JSON format:
{
  "restaurantName": "name of restaurant",
  "items": [
    {"name": "item name", "quantity": 1, "price": 12.99}
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "total": 0.00
}

Rules:
- Only include actual food/drink items in the items array
- Skip service charges, order numbers, dates, phone numbers, addresses
- Use the exact item names from the receipt
- Parse quantities if shown (e.g., "2x Burger" = quantity: 2)
- All prices should be numbers, not strings
- If tip is not on receipt, set it to 0
- Calculate total as subtotal + tax + tip if not shown

Return ONLY the JSON object, no additional text.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from vision model");
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from response");
      }

      const data = JSON.parse(jsonMatch[0]);
      res.json(data);
      
    } catch (error: any) {
      console.error("Vision API Error:", error);
      res.status(500).json({ message: error.message || "Failed to scan receipt" });
    }
  });

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

  // Receipt People routes
  app.get("/api/receipts/:id/people", async (req, res) => {
    try {
      const people = await storage.getReceiptPeople(req.params.id);
      res.json(people);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/receipts/:id/people", async (req, res) => {
    try {
      const { personId } = req.body;
      if (!personId) {
        return res.status(400).json({ message: "personId is required" });
      }
      const receiptPerson = await storage.addPersonToReceipt(req.params.id, personId);
      res.json(receiptPerson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/receipts/:id/people/:personId", async (req, res) => {
    try {
      await storage.removePersonFromReceipt(req.params.id, req.params.personId);
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

  app.post("/api/share/:token/verify-phone", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

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

      const assignedPeople = allPeople.filter(person => assignedPersonIds.has(person.id));
      
      const matchingPerson = assignedPeople.find(p => p.phone === phone);
      
      if (matchingPerson) {
        return res.json({ 
          verified: true, 
          personId: matchingPerson.id,
          personName: matchingPerson.name
        });
      }

      const unmatchedPeople = assignedPeople
        .filter(p => !p.phone)
        .map(p => ({ id: p.id, name: p.name }));

      res.json({ 
        verified: false, 
        unmatchedPeople 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/share/:token/link-phone", async (req, res) => {
    try {
      const { phone, personId, name } = req.body;
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

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

      let person;
      if (personId) {
        if (!assignedPersonIds.has(personId)) {
          return res.status(403).json({ message: "This person is not assigned to this receipt" });
        }
        
        await storage.updatePerson(personId, { phone });
        person = await storage.getPerson(personId);
        if (!person) {
          return res.status(404).json({ message: "Person not found" });
        }
      } else if (name) {
        person = await storage.createPerson({ name, phone });
      } else {
        return res.status(400).json({ message: "Either personId or name is required" });
      }

      res.json({ 
        verified: true, 
        personId: person.id,
        personName: person.name
      });
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

  // Payment routes
  app.post("/api/receipts/:receiptId/payments", async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse({
        ...req.body,
        receiptId: req.params.receiptId
      });
      const payment = await storage.createPayment(validatedData);
      res.json(payment);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.get("/api/receipts/:receiptId/payments", async (req, res) => {
    try {
      const payments = await storage.getPayments(req.params.receiptId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      await storage.deletePayment(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/receipts/:receiptId/settlement", async (req, res) => {
    try {
      const settlement = await storage.calculateSettlement(req.params.receiptId);
      res.json(settlement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
