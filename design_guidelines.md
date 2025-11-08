# Design Guidelines: Bill Splitting App

## Design Approach
**System**: Apple Human Interface Guidelines (iOS-first)
**Rationale**: Mobile utility app requiring clear information hierarchy, efficient interactions, and familiar patterns for quick adoption at the dining table.

## Typography System
- **Primary Font**: SF Pro (System default) via system font stack
- **Hierarchy**:
  - Page Titles: text-3xl font-bold (30px)
  - Section Headers: text-xl font-semibold (20px)
  - Item Names: text-base font-medium (16px)
  - Prices/Metadata: text-sm font-normal (14px)
  - Helper Text: text-xs (12px)

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8 (8px increments)
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- List item gaps: gap-4
- Screen margins: px-4 (mobile), px-6 (tablet)
- Touch targets: Minimum h-12 for all interactive elements

**Container Strategy**:
- Full-width mobile: max-w-full
- Tablet view: max-w-2xl mx-auto
- Content cards: rounded-xl with shadow-sm

## Core Components

### Navigation
- Bottom tab bar (iOS pattern) with 3-4 primary sections: Receipts, Regulars, History, Profile
- Top navigation bar with contextual actions (Edit, Share, Add)
- Back navigation in top-left for drill-down views

### Receipt Display
- Card-based list with clear visual separation
- Each receipt item shows: name, quantity, price, assignment status
- Assignment indicators: Small circular badges (w-6 h-6) with initials positioned right-aligned
- Unassigned items: Subtle visual treatment (opacity-60)
- Total summary: Sticky footer card showing subtotal, tax, tip, grand total

### Assignment Interface
- Modal bottom sheet (slides up from bottom)
- Person selection: Large touch-friendly buttons (h-14) with names
- Multi-select chips for split items
- Clear "Done" action button

### Receipt Scanner
- Full-screen camera view with overlay guide frame
- Upload from gallery alternative button
- Loading state with progress indicator during OCR processing

### Editing Interface
- Inline editing for item names, prices, quantities
- Add item: Floating action button (FAB) bottom-right
- Swipe-to-delete gesture for removing items
- Input fields: Large touch targets with clear focus states

### Regulars Management
- List view with avatar placeholders (w-10 h-10 circular)
- Search bar at top: sticky position
- Add new person: Prominent button at top
- Quick actions: Swipe gestures for edit/delete

### Share View
- Per-person breakdown cards
- Itemized list with quantities and prices
- Summary showing subtotal + tax share + tip share = total
- Share buttons: Native share sheet integration

## Component Library

**Buttons**:
- Primary: Rounded-lg, font-semibold, h-12 minimum
- Secondary: Outlined variant with border-2
- Icon buttons: w-10 h-10, rounded-full for circular actions

**Cards**:
- Receipt items: rounded-lg, p-4, border or shadow-sm
- Summary cards: rounded-xl, p-6, prominent shadow

**Form Inputs**:
- Text fields: h-12, rounded-lg, px-4, border-2
- Number inputs: Include increment/decrement steppers
- Labels: text-sm font-medium, mb-2

**Badges**:
- Assignment initials: Circular (w-6 h-6), centered text
- Status indicators: Small rounded pills for "Paid", "Pending"

**Lists**:
- Dividers: border-b between items
- Swipe actions: Reveal delete/edit on horizontal swipe
- Empty states: Centered icon + message for zero-state

## Images
No hero images needed. This is a utility app focused on functionality.

**Icon Usage**: Use SF Symbols (iOS) or Heroicons for consistent iconography throughout - camera, person, checkmark, plus, share, trash, pencil icons.

## Animations
Minimal, functional only:
- Modal sheet slide-up transitions (300ms ease)
- Success checkmark after assignment (subtle scale)
- Loading spinners during OCR processing
- No decorative animations

## Mobile-First Constraints
- All touch targets minimum 44x44pt (h-12)
- Thumb-zone optimization: Primary actions in bottom third of screen
- Single-column layouts throughout
- Scrollable content with pull-to-refresh on receipt list
- Safe area insets respected for notched devices