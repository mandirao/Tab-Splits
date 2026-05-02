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
