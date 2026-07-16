import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { db } from "./db";
import { getResendClient } from "./resend";
import { ipRateLimit, userRateLimit } from "./rateLimit";
import { sql, gte, isNotNull } from "drizzle-orm";
import { users as usersTable, receipts as receiptsTable } from "../shared/schema";
import { 
  insertReceiptSchema, 
  insertReceiptItemSchema, 
  insertPersonSchema,
  insertPaymentSchema,
  updateReceiptSchema,
  updateReceiptItemSchema,
  updatePersonSchema,
  registerSchema,
  loginSchema,
  type Receipt,
  type Person,
} from "../shared/schema";
import { fromError } from "zod-validation-error";
import OpenAI from "openai";
import { registerObjectStorageRoutes } from "./objectStorage";
import bcrypt from "bcrypt";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// ─── Ownership helpers ────────────────────────────────────────────────────────

async function getOwnedReceipt(
  receiptId: string,
  userId: string,
  res: Response
): Promise<Receipt | null> {
  const receipt = await storage.getReceipt(receiptId);
  if (!receipt) {
    res.status(404).json({ message: "Receipt not found" });
    return null;
  }
  if (receipt.userId !== userId) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return receipt;
}

async function getOwnedPerson(
  personId: string,
  userId: string,
  res: Response
): Promise<Person | null> {
  const person = await storage.getPerson(personId);
  if (!person) {
    res.status(404).json({ message: "Person not found" });
    return null;
  }
  if (person.userId !== userId) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return person;
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerObjectStorageRoutes(app);

  // ─── Auth routes (public) ────────────────────────────────────────────────

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName,
    });
  });

  app.post("/api/auth/register", ipRateLimit(5, 60 * 60 * 1000, "Too many accounts created from this device. Try again in an hour."), async (req, res) => {
    try {
      const { email, password, name } = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUser(email.toLowerCase(), passwordHash, name);
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.name;
      res.status(201).json({ id: user.id, email: user.email, name: user.name });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", ipRateLimit(10, 15 * 60 * 1000, "Too many sign-in attempts. Please wait 15 minutes and try again."), async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.name;
      res.json({ id: user.id, email: user.email, name: user.name });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(204).send();
    });
  });

  app.post("/api/auth/forgot-password", ipRateLimit(5, 15 * 60 * 1000, "Too many reset attempts. Please wait 15 minutes and try again."), async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }
      // Always return the same response body so the API never reveals
      // whether an email address is registered (prevents enumeration).
      const NEUTRAL_MESSAGE = "If an account exists for that email, a reset link has been sent.";
      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.json({ message: NEUTRAL_MESSAGE });
      }
      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.setUserResetToken(user.id, token, expiry);

      // Determine the base URL from the request so the link works in both
      // dev and production without hardcoding a domain.
      const protocol = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
      const host = req.headers["x-forwarded-host"] ?? req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      try {
        const { client, fromEmail } = await getResendClient();
        await client.emails.send({
          from: `Tab Splits <${fromEmail}>`,
          to: user.email,
          subject: "Reset your Tab Splits password",
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="margin:0 0 8px;font-size:20px">Reset your password</h2>
              <p style="color:#555;margin:0 0 24px">
                We received a request to reset the password for your Tab Splits account.<br>
                This link expires in 1 hour.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#fff;
                        text-decoration:none;border-radius:8px;font-weight:600">
                Reset Password
              </a>
              <p style="color:#aaa;font-size:12px;margin-top:32px">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send password reset email:", emailErr);
        // Still return success — don't leak internal errors to the client
      }

      res.json({ message: NEUTRAL_MESSAGE });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/reset-password", ipRateLimit(10, 15 * 60 * 1000), async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password || typeof token !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiry) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }
      if (new Date() > new Date(user.resetTokenExpiry)) {
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateUserPassword(user.id, passwordHash);
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Shared receipt routes (public — no auth required) ───────────────────

  app.get("/api/share/:token", async (req, res) => {
    try {
      const receipt = await storage.getReceiptByShareToken(req.params.token);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      const items = await storage.getReceiptItems(receipt.id);
      const receiptPeople = await storage.getReceiptPeople(receipt.id);
      
      const paidByPerson = receipt.paidById
        ? receiptPeople.find(p => p.id === receipt.paidById) ?? await storage.getPerson(receipt.paidById)
        : null;
      
      const assignedPersonIds = new Set<string>();
      items.forEach(item => {
        ((item.assignedTo as string[]) || []).forEach(id => assignedPersonIds.add(id));
      });

      const redactedPeople = receiptPeople
        .filter(person => assignedPersonIds.has(person.id))
        .map(person => ({ id: person.id, name: person.name }));
      
      const redactedReceipt = {
        id: receipt.id,
        restaurantName: receipt.restaurantName,
        date: receipt.date,
        subtotal: receipt.subtotal,
        tax: receipt.tax,
        tip: receipt.tip,
        total: receipt.total,
        imageUrl: receipt.imageUrl,
        paidById: receipt.paidById,
        paidByName: paidByPerson?.name || null,
        paidByVenmo: (paidByPerson as any)?.venmoUsername || null,
      };
      
      res.json({ receipt: redactedReceipt, items, people: redactedPeople });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/share/:token/verify-phone", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ message: "Phone number is required" });

      const receipt = await storage.getReceiptByShareToken(req.params.token);
      if (!receipt) return res.status(404).json({ message: "Receipt not found" });

      const receiptPeople = await storage.getReceiptPeople(receipt.id);
      const matchingPerson = receiptPeople.find(p => p.phone === phone);
      
      if (matchingPerson) {
        return res.json({ verified: true, personId: matchingPerson.id, personName: matchingPerson.name });
      }

      const unmatchedPeople = receiptPeople
        .filter(p => !p.phone)
        .map(p => ({ id: p.id, name: p.name }));

      res.json({ verified: false, unmatchedPeople });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/share/:token/link-phone", async (req, res) => {
    try {
      const { phone, personId, name } = req.body;
      if (!phone) return res.status(400).json({ message: "Phone number is required" });

      const receipt = await storage.getReceiptByShareToken(req.params.token);
      if (!receipt) return res.status(404).json({ message: "Receipt not found" });

      const receiptPeople = await storage.getReceiptPeople(receipt.id);
      const assignedPersonIds = new Set(receiptPeople.map(p => p.id));

      let person;
      if (personId) {
        if (!assignedPersonIds.has(personId)) {
          return res.status(403).json({ message: "This person is not assigned to this receipt" });
        }
        await storage.updatePerson(personId, { phone });
        person = await storage.getPerson(personId);
        if (!person) return res.status(404).json({ message: "Person not found" });
      } else if (name) {
        person = await storage.createPerson({ name, phone });
      } else {
        return res.status(400).json({ message: "Either personId or name is required" });
      }

      res.json({ verified: true, personId: person.id, personName: person.name });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── All routes below require auth ───────────────────────────────────────

  app.post("/api/scan-receipt", requireAuth, userRateLimit(30, 60 * 60 * 1000, "Scan limit reached. You can scan up to 30 receipts per hour."), async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ message: "No image provided" });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this restaurant receipt image and extract ALL information in JSON format:
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

CRITICAL REQUIREMENTS:
1. Extract EVERY SINGLE food/drink item - do not skip any items
2. Count items carefully and double-check you captured them all
3. Use exact item names from the receipt
4. Parse quantities if shown (e.g., "2x Burger" = quantity: 2)
5. All prices must be numbers, not strings

AUTO-GRATUITY / INCLUDED TIP DETECTION (very important):
- Look for line items labeled: "Gratuity", "Auto Gratuity", "Auto-Grat", "Service Charge", "Mandatory Gratuity", "Suggested Gratuity", "Included Tip", or any similar label
- If found as a LINE ITEM: do NOT include it in the items array. Instead, put its amount in the "tip" field
- If found in the subtotal section or as a separate charge after subtotal: capture the amount in the "tip" field
- If the subtotal label says something like "Subtotal (incl. 18% gratuity)" or similar, try to back-calculate the gratuity amount and put it in "tip"
- If a separate tip/gratuity line AND a customer-added tip both appear, sum them into the "tip" field
- If no tip or gratuity appears anywhere on the receipt, set tip to 0

ITEMS LIST:
- Skip ONLY: order numbers, dates, phone numbers, addresses, headers/footers, tax lines, and any gratuity/tip/service charge lines (those go in "tip")
- Do NOT skip modifiers, add-ons, or substitutions that have a price
- If the same item name appears on multiple lines (e.g. "2x Lychee Martini" and "1x Lychee Martini"), COMBINE them into a single entry with the total quantity and the per-unit price

MATH VERIFICATION:
- sum of (item.price * item.quantity) should equal subtotal (before tax/tip)
- subtotal + tax + tip should equal total

Return ONLY the JSON object, no additional text.`
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image}` }
              }
            ]
          }
        ],
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("No response from vision model");

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse JSON from response");

      const data = JSON.parse(jsonMatch[0]);

      const GRATUITY_PATTERN = /auto.?grat|gratuity|service.?charge|mandatory.?grat|suggested.?grat|included.?tip|auto.?tip/i;
      if (Array.isArray(data.items)) {
        const gratItems: any[] = [];
        const cleanItems: any[] = [];
        for (const item of data.items) {
          if (GRATUITY_PATTERN.test(String(item.name ?? ""))) {
            gratItems.push(item);
          } else {
            cleanItems.push(item);
          }
        }
        if (gratItems.length > 0) {
          const gratTotal = gratItems.reduce((sum: number, it: any) => sum + (Number(it.price) * (Number(it.quantity) || 1)), 0);
          data.items = cleanItems;
          data.subtotal = Math.max(0, Number(data.subtotal ?? 0) - gratTotal);
          const currentTip = Number(data.tip ?? 0);
          if (currentTip < gratTotal - 0.01) data.tip = currentTip + gratTotal;
          data.total = Number(data.subtotal) + Number(data.tax ?? 0) + Number(data.tip);
        }
      }

      {
        const s = Number(data.subtotal ?? 0);
        const x = Number(data.tax ?? 0);
        const t = Number(data.tip ?? 0);
        const tot = Number(data.total ?? 0);
        if (t > 0 && Math.abs((s + x) - tot) < 0.05) {
          data.subtotal = +(s - t).toFixed(2);
        }
      }

      // Merge duplicate item names (same name, possibly split across multiple lines)
      if (Array.isArray(data.items) && data.items.length > 1) {
        const normalize = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
        const seen: Record<string, { name: string; quantity: number; totalPrice: number }> = {};
        for (const item of data.items) {
          const key = normalize(item.name);
          const qty = Math.max(1, Number(item.quantity) || 1);
          const unitPrice = Number(item.price) || 0;
          if (seen[key]) {
            seen[key].quantity += qty;
            seen[key].totalPrice += unitPrice * qty;
          } else {
            seen[key] = { name: item.name, quantity: qty, totalPrice: unitPrice * qty };
          }
        }
        data.items = Object.values(seen).map(m => ({
          name: m.name,
          quantity: m.quantity,
          price: +(m.totalPrice / m.quantity).toFixed(2),
        }));
      }

      res.json(data);
    } catch (error: any) {
      console.error("Vision API Error:", error);
      res.status(500).json({ message: error.message || "Failed to scan receipt" });
    }
  });

  // ─── AI categorize items ───────────────────────────────────────────────────

  app.post("/api/receipts/:id/categorize", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;

      const items = await storage.getReceiptItems(req.params.id);
      if (items.length === 0) return res.json([]);

      const itemList = items.map(i => `${i.id}|${i.name}`).join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: `Categorize each restaurant menu item as exactly one of: "appetizer", "meal", "drink", "dessert", or "other".

Rules:
- "appetizer": starters — shared plates, small bites, dips, spreads, anything served before the main course
- "meal": main courses — entrees, salads, soups, sandwiches, sides, any savory dish that is a full portion
- "drink": any beverage — water, soda, juice, coffee, tea, beer, wine, cocktails, smoothies
- "dessert": sweets — ice cream, cake, pie, cookies, pastries, any post-meal sweet
- "other": service charges, fees, non-food items

Items (format: id|name):
${itemList}

Return ONLY a JSON object mapping each ID to its category: {"id1": "meal", "id2": "drink", ...}`,
        }],
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ message: "Failed to parse AI response" });

      const categories: Record<string, string> = JSON.parse(jsonMatch[0]);
      const validCategories = ["appetizer", "meal", "drink", "dessert", "other"];

      const updatedItems = await Promise.all(
        items.map(item => {
          const cat = categories[item.id];
          const category = validCategories.includes(cat) ? cat : "other";
          return storage.updateReceiptItem(item.id, { category } as any);
        })
      );

      res.json(updatedItems);
    } catch (error: any) {
      console.error("Categorize error:", error.message);
      res.status(500).json({ message: error.message || "Failed to categorize items" });
    }
  });

  // ─── Receipt routes ───────────────────────────────────────────────────────

  app.post("/api/receipts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const receipt = await storage.createReceipt(validatedData);
      res.json(receipt);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.get("/api/receipts", requireAuth, async (req, res) => {
    try {
      const receipts = await storage.getAllReceipts(req.session.userId!);
      res.json(receipts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const receipt = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!receipt) return;
      res.json(receipt);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      const validatedData = updateReceiptSchema.parse(req.body);
      const receipt = await storage.updateReceipt(req.params.id, validatedData);
      res.json(receipt);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      await storage.deleteReceipt(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Receipt Item routes ──────────────────────────────────────────────────

  app.post("/api/receipts/:receiptId/items", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.receiptId, req.session.userId!, res);
      if (!owned) return;
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

  app.get("/api/receipts/:receiptId/items", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.receiptId, req.session.userId!, res);
      if (!owned) return;
      const items = await storage.getReceiptItems(req.params.receiptId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getReceiptItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Item not found" });
      const owned = await getOwnedReceipt(item.receiptId, req.session.userId!, res);
      if (!owned) return;
      const validatedData = updateReceiptItemSchema.parse(req.body);
      const updated = await storage.updateReceiptItem(req.params.id, validatedData);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.delete("/api/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getReceiptItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Item not found" });
      const owned = await getOwnedReceipt(item.receiptId, req.session.userId!, res);
      if (!owned) return;
      await storage.deleteReceiptItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/receipts/:id/items", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      await storage.clearReceiptItems(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── People routes ────────────────────────────────────────────────────────

  app.post("/api/people", requireAuth, async (req, res) => {
    try {
      const validatedData = insertPersonSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const person = await storage.createPerson(validatedData);
      res.json(person);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.get("/api/people", requireAuth, async (req, res) => {
    try {
      const allPeople = await storage.getAllPeople(req.session.userId!);
      res.json(allPeople);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/people/regulars", requireAuth, async (req, res) => {
    try {
      const regulars = await storage.getRegulars(req.session.userId!);
      res.json(regulars);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/people/:id", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedPerson(req.params.id, req.session.userId!, res);
      if (!owned) return;
      const validatedData = updatePersonSchema.parse(req.body);
      const person = await storage.updatePerson(req.params.id, validatedData);
      res.json(person);
    } catch (error: any) {
      res.status(400).json({ message: fromError(error).toString() });
    }
  });

  app.delete("/api/people/:id", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedPerson(req.params.id, req.session.userId!, res);
      if (!owned) return;
      await storage.deletePerson(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Receipt People routes ────────────────────────────────────────────────

  app.get("/api/receipts/:id/people", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      const people = await storage.getReceiptPeople(req.params.id);
      res.json(people);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/receipts/:id/people", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      const { personId } = req.body;
      if (!personId) return res.status(400).json({ message: "personId is required" });
      const receiptPerson = await storage.addPersonToReceipt(req.params.id, personId);
      res.json(receiptPerson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/receipts/:id/people/:personId", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      await storage.removePersonFromReceipt(req.params.id, req.params.personId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Share token generation ───────────────────────────────────────────────

  app.post("/api/receipts/:id/generate-share-token", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.id, req.session.userId!, res);
      if (!owned) return;
      const receipt = await storage.generateShareToken(req.params.id);
      if (!receipt) return res.status(404).json({ message: "Receipt not found" });
      res.json({ shareToken: receipt.shareToken });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Payment routes ───────────────────────────────────────────────────────

  app.post("/api/receipts/:receiptId/payments", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.receiptId, req.session.userId!, res);
      if (!owned) return;
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

  app.get("/api/receipts/:receiptId/payments", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.receiptId, req.session.userId!, res);
      if (!owned) return;
      const payments = await storage.getPayments(req.params.receiptId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      const owned = await getOwnedReceipt(payment.receiptId, req.session.userId!, res);
      if (!owned) return;
      await storage.deletePayment(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/receipts/:receiptId/settlement", requireAuth, async (req, res) => {
    try {
      const owned = await getOwnedReceipt(req.params.receiptId, req.session.userId!, res);
      if (!owned) return;
      const settlement = await storage.calculateSettlement(req.params.receiptId);
      res.json(settlement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Admin stats ──────────────────────────────────────────────────────────

  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsersResult,
        newUsersTodayResult,
        newUsersWeekResult,
        totalReceiptsResult,
        receiptsTodayResult,
        receiptsWeekResult,
        receiptsMonthResult,
        scannedResult,
        sharedResult,
        dailyTrend,
        activeAdmins,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
        db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(gte(usersTable.createdAt, today)),
        db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(gte(usersTable.createdAt, weekAgo)),
        db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable),
        db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable).where(gte(receiptsTable.date, today)),
        db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable).where(gte(receiptsTable.date, weekAgo)),
        db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable).where(gte(receiptsTable.date, monthAgo)),
        db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable).where(isNotNull(receiptsTable.imageUrl)),
        db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable).where(isNotNull(receiptsTable.shareToken)),
        db.execute(sql`
          SELECT date_trunc('day', date)::date::text AS day, count(*)::int AS count
          FROM receipts
          WHERE date >= ${weekAgo}
          GROUP BY 1
          ORDER BY 1
        `),
        db.execute(sql`
          SELECT count(DISTINCT user_id)::int AS count
          FROM receipts
          WHERE date >= ${weekAgo}
        `),
      ]);

      res.json({
        users: {
          total: totalUsersResult[0]?.count ?? 0,
          newToday: newUsersTodayResult[0]?.count ?? 0,
          newThisWeek: newUsersWeekResult[0]?.count ?? 0,
        },
        receipts: {
          total: totalReceiptsResult[0]?.count ?? 0,
          today: receiptsTodayResult[0]?.count ?? 0,
          thisWeek: receiptsWeekResult[0]?.count ?? 0,
          thisMonth: receiptsMonthResult[0]?.count ?? 0,
          withOcr: scannedResult[0]?.count ?? 0,
          shared: sharedResult[0]?.count ?? 0,
        },
        activeAdminsThisWeek: Number((activeAdmins.rows[0] as any)?.count ?? 0),
        dailyTrend: dailyTrend.rows,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
