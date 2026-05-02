# Tab Splits - Bill Splitting Application

## Overview

Tab Splits is a mobile-first bill splitting application that helps groups divide restaurant bills fairly and efficiently. The app allows users to scan receipts, manually add items, assign items to different people, calculate individual shares including tax and tip, and share payment summaries. Built with a focus on simplicity and ease of use at the dining table, it follows Apple Human Interface Guidelines for an intuitive iOS-like experience.

### Key Features
- Email + password authentication with persistent sessions (PostgreSQL-backed)
- Multi-account support: each admin has their own isolated receipts and people
- Receipt scanning via OCR (OpenAI Vision API)
- Manual item addition and deletion
- Running total verification (items vs receipt subtotal)
- Person assignment with colorful visual indicators
- Proportional tax/tip calculation
- Payment tracking and settlement calculation
- Secure public receipt sharing via QR code or SMS (no auth needed for diners)
- Scanned receipt image viewing on shared tabs for independent verification
- "Paid by" selector to mark who paid the bill with Venmo username
- One-tap Venmo payment from shared receipt (opens Venmo app with correct amount)
- Bulk item assignment: long-press any item (or tap the multi-select icon) to enter bulk mode, check multiple items, then assign them all to the same people at once
- AI item categorization: tap the Sparkles icon to have GPT-4o automatically sort items into Appetizers, Meals, Drinks, and Desserts; category tabs appear in the tab bar and items are grouped by category in both the admin list view and the shared receipt view for diners
- Guided 7-step wizard: "Split new tab" launches a full-screen step-by-step flow — Scan → Review Items+Categories → **Format** → Add Diners → Assign → Tip → Who Paid — with a progress bar, back/forward navigation, and "Exit to receipt" escape hatch at any step; AI auto-categorizes items silently in the background when the Items step loads; completing the wizard lands on the admin receipt view with a success toast prompting a final review before sharing
- Dining format picker (wizard step 3): choose Family Style (all food split equally, drinks per-seat), Courses (apps+desserts shared, entrees+drinks individual), or Mixed Bag (full manual control); Family Style and Courses auto-assign shared items to everyone when the Assign step loads, eliminating most manual tapping
- Entree-count indicator (Courses format): live scoreboard card in the Assign step shows each diner's avatar with a colored badge — green=1 entree, amber=none yet, red=2+ — to prevent accidentally double-assigning or skipping an entree

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query for server state management and caching
- Tailwind CSS with shadcn/ui component library following the "new-york" style

**Design System:**
- Mobile-first responsive design optimized for iOS patterns
- SF Pro font system via system font stack
- Custom color palette with predefined person colors (10 distinct HSL values)
- Spacing based on Tailwind's 8px increment system (2, 4, 6, 8 units)
- Minimum touch target height of 48px (h-12) for accessibility

**Component Architecture:**
- Reusable UI components built on Radix UI primitives
- Custom domain components: ReceiptCard, ReceiptItemRow, PersonChip, PersonSummaryCard, RegularPersonCard, TipCalculator, BottomSheet
- Page-based routing with dedicated views: HomePage, ReceiptDetailPage, SummaryPage, RegularsPage, ScanReceiptPage

**State Management Strategy:**
- Server state cached via TanStack Query with manual invalidation on mutations
- Local UI state managed with React hooks (useState, useEffect)
- No global state management library - keeps architecture simple
- Query keys follow RESTful pattern: ["/api/resource", id]

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Drizzle ORM for type-safe database operations
- Zod for runtime schema validation
- Neon PostgreSQL serverless database with WebSocket connection pooling

**API Design:**
- RESTful API endpoints under `/api` prefix
- CRUD operations for three main resources: receipts, receipt items, and people
- Request validation using Zod schemas with friendly error messages via zod-validation-error
- Response format: JSON with appropriate HTTP status codes

**Database Schema:**
- Three main tables: `receipts`, `receipt_items`, `people`
- Receipts store: restaurant name, date, financial totals (subtotal, tax, tip, total), optional image URL
- Receipt items store: name, quantity, price, and array of assigned person IDs (JSONB column)
- People store: name, contact info (phone, email), and regular status flag
- All numeric currency values stored as DECIMAL(10,2) for precision
- UUID primary keys generated via PostgreSQL's gen_random_uuid()

**Shared Utilities (`client/src/lib/`):**
- `categories.ts` — single source of truth for category constants (`CAT_LABELS`, `CAT_LABELS_SINGULAR`, `CAT_LABELS_SHORT`, `CATEGORY_ORDER`) and `getInitials(name)` helper; imported by all pages and components

**Server Architecture:**
- Separation of concerns: routes.ts handles HTTP layer, storage.ts handles data layer
- Interface-based storage layer (IStorage) for potential future abstraction
- Middleware for request logging with response time tracking
- Development-only Vite middleware for HMR and SSR

### Receipt Scanning Feature

**OCR Integration:**
- OpenAI Vision API (GPT-4o) for highly accurate receipt text extraction
- Uses Replit AI Integrations for seamless API key management (charges to Replit credits)
- Intelligent parsing of restaurant name, items (name/quantity/price), subtotal, tax, tip, and total
- Image rotation controls (rotate left/right 90°) before scanning to ensure vertical orientation
- Canvas-based image rotation applies transformation before sending to OCR for better accuracy
- Scanned images stored in browser sessionStorage with key `scanned_image_${receiptId}`

**Validation System:**
- Automatic math validation compares extracted items vs. receipt totals
- Triggers warning if item subtotal differs from reported subtotal by >$0.50
- Persistent validation warning banner displays on receipt detail page until acknowledged
- Warning data stored in sessionStorage with key `receipt-${receiptId}-warning`
- Includes discrepancy amounts, item count, and reference to scanned image

**Image Viewing:**
- Header button (image icon) shows scanned receipt anytime after scanning
- "View Image" button in validation warning banner for comparison during correction
- Full-size dialog displays original receipt for manual verification
- Enables users to spot and add missing items OCR failed to capture

**Trade-offs:**
- OpenAI Vision chosen for superior accuracy over Tesseract.js (client-side OCR)
- API costs offset by eliminating manual data entry time
- SessionStorage approach keeps images temporary (cleared on browser close) for privacy

### Person Assignment System

**Color Assignment:**
- 10 predefined HSL color values ensure visual distinction between people
- Colors assigned sequentially as people are added to a receipt
- Person initials displayed in colored circles for quick visual identification
- Initials generated from first letters of first/last name

**Assignment Logic:**
- Items can be assigned to multiple people (split items)
- Proportional tax and tip calculation based on subtotal share
- Unassigned items visually de-emphasized (opacity-60)
- Assignment state stored as JSON array in database for flexibility

### Navigation Pattern

**Bottom Sheet Pattern:**
- iOS-style modal bottom sheets for assignment interfaces
- Slides up from bottom with backdrop overlay
- Touch-friendly person selection with large tap targets (h-14)
- Clear visual feedback for selected state with primary color highlight

**Rationale:**
- Bottom sheets keep context visible while providing focused interaction
- Familiar pattern from iOS apps reduces learning curve
- Easier thumb access on large mobile screens compared to center modals

## External Dependencies

### Database
- **Neon Serverless PostgreSQL**: Managed PostgreSQL with WebSocket support for serverless environments
- **Connection**: Uses WebSocket constructor (ws package) for Node.js compatibility
- **Environment**: Requires DATABASE_URL environment variable

### UI Component Library
- **shadcn/ui**: Unstyled, accessible component primitives based on Radix UI
- **Radix UI**: ~20 primitive components for dialogs, dropdowns, forms, etc.
- **Configuration**: "new-york" style variant with neutral base color and CSS variables enabled

### Form & Validation
- **React Hook Form**: Form state management with @hookform/resolvers for Zod integration
- **Zod**: Runtime type validation for API requests and form inputs
- **drizzle-zod**: Automatic Zod schema generation from Drizzle database schemas

### Styling
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **class-variance-authority**: Type-safe variant management for component styles
- **clsx & tailwind-merge**: Class name merging utilities

### Development Tools
- **Vite**: Fast development server with HMR
- **TypeScript**: Type safety across frontend and backend
- **esbuild**: Production bundling for server code
- **Replit plugins**: Runtime error modal, cartographer, and dev banner (development only)

### Additional Libraries
- **date-fns**: Date formatting and manipulation
- **Tesseract.js**: Browser-based OCR for receipt scanning
- **nanoid**: Unique ID generation
- **embla-carousel**: Touch-friendly carousel component (imported but usage unclear)
- **wouter**: Minimal client-side router (~1KB)

### Session Management
- **connect-pg-simple**: PostgreSQL session store for Express sessions (imported but session middleware not evident in provided code)