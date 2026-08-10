import { getInitials, PERSON_COLORS } from "@/lib/categories";

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function firstNameOnly(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export interface PersonWithColor {
  id: string;
  name: string;
  color: string;
}

/**
 * Assigns display colors to a list of people and returns lookup helpers.
 * Only ever returns {id, name, color} regardless of what extra fields the
 * input people have (e.g. phone/email/venmoUsername) — callers that need
 * those fields must read them from their own original data, not from here.
 */
export function getPeopleWithColors<T extends { id: string; name: string }>(
  people: T[]
): {
  peopleWithColors: PersonWithColor[];
  getPersonById: (id: string) => PersonWithColor | undefined;
  getColorForPerson: (id: string) => string;
  getInitialsForPerson: (id: string) => string;
} {
  const peopleWithColors: PersonWithColor[] = people.map((person, idx) => ({
    id: person.id,
    name: person.name,
    color: PERSON_COLORS[idx % PERSON_COLORS.length],
  }));

  const getPersonById = (id: string) => peopleWithColors.find(p => p.id === id);
  const getColorForPerson = (id: string) => getPersonById(id)?.color || PERSON_COLORS[0];
  const getInitialsForPerson = (id: string) => {
    const person = getPersonById(id);
    return person ? getInitials(person.name) : "";
  };

  return { peopleWithColors, getPersonById, getColorForPerson, getInitialsForPerson };
}
