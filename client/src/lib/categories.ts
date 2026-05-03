export const PERSON_COLORS = [
  'hsl(38, 92%, 50%)',   // Amber
  'hsl(17, 81%, 53%)',   // Coral
  'hsl(345, 77%, 57%)',  // Raspberry
  'hsl(258, 90%, 66%)',  // Violet
  'hsl(217, 91%, 60%)',  // Blue
  'hsl(164, 87%, 39%)',  // Teal
  'hsl(142, 71%, 45%)',  // Lime
  'hsl(330, 81%, 60%)',  // Pink
];

export const CAT_LABELS: Record<string, string> = {
  appetizer: "Appetizers",
  meal: "Meals",
  drink: "Drinks",
  dessert: "Desserts",
  other: "Other",
};

export const CAT_LABELS_SINGULAR: Record<string, string> = {
  appetizer: "Appetizer",
  meal: "Meal",
  drink: "Drink",
  dessert: "Dessert",
  other: "Other",
};

export const CAT_LABELS_SHORT: Record<string, string> = {
  appetizer: "Apps",
  meal: "Meals",
  drink: "Drinks",
  dessert: "Desserts",
  other: "Other",
};

export const CATEGORY_ORDER = ["appetizer", "meal", "dessert", "other", "drink"] as const;

export type CategoryKey = typeof CATEGORY_ORDER[number];

export function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
