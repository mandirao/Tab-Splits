import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import PersonChip from "@/components/PersonChip";
import { getInitials } from "@/lib/categories";

export interface PersonWithColor {
  id: string;
  name: string;
  color: string;
}

export interface AssignPersonSheetBodyProps {
  people: PersonWithColor[];
  selectedPeople: string[];
  assignedQuantities: Record<string, number>;
  onSelectedPeopleChange: (ids: string[]) => void;
  onAssignedQuantitiesChange: (qtys: Record<string, number>) => void;
  resetKey?: string | null;
  addPersonSlot?: React.ReactNode;
  getChipAnnotation?: (personId: string) => React.ReactNode;
}

export default function AssignPersonSheetBody({
  people,
  selectedPeople,
  assignedQuantities,
  onSelectedPeopleChange,
  onAssignedQuantitiesChange,
  resetKey,
  addPersonSlot,
  getChipAnnotation,
}: AssignPersonSheetBodyProps) {
  const hasSavedShares =
    selectedPeople.length > 1 &&
    selectedPeople.some((pid) => (assignedQuantities[pid] ?? 0) > 0);
  const [splitMode, setSplitMode] = useState<"equal" | "share">(
    hasSavedShares ? "share" : "equal"
  );

  useEffect(() => {
    const hasSaved =
      selectedPeople.length > 1 &&
      selectedPeople.some((pid) => (assignedQuantities[pid] ?? 0) > 0);
    setSplitMode(hasSaved ? "share" : "equal");
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const allIds = people.map((p) => p.id);
  const everyoneSelected =
    allIds.length > 0 && allIds.every((id) => selectedPeople.includes(id));

  const handleTogglePerson = (personId: string) => {
    const isSelected = selectedPeople.includes(personId);
    if (isSelected) {
      const next = selectedPeople.filter((pid) => pid !== personId);
      onSelectedPeopleChange(next);
      const newQtys = { ...assignedQuantities };
      delete newQtys[personId];
      onAssignedQuantitiesChange(newQtys);
    } else {
      const next = [...selectedPeople, personId];
      onSelectedPeopleChange(next);
      if (splitMode === "share") {
        onAssignedQuantitiesChange({ ...assignedQuantities, [personId]: 1 });
      }
    }
  };

  const handleSelectEveryone = () => {
    if (everyoneSelected) {
      onSelectedPeopleChange([]);
      onAssignedQuantitiesChange({});
    } else {
      onSelectedPeopleChange(allIds);
      if (splitMode === "share") {
        const newQtys: Record<string, number> = {};
        allIds.forEach((id) => {
          newQtys[id] = assignedQuantities[id] || 1;
        });
        onAssignedQuantitiesChange(newQtys);
      }
    }
  };

  const handleSplitModeChange = (mode: "equal" | "share") => {
    setSplitMode(mode);
    if (mode === "equal") {
      onAssignedQuantitiesChange({});
    } else {
      const newQtys: Record<string, number> = {};
      selectedPeople.forEach((pid) => {
        newQtys[pid] = assignedQuantities[pid] || 1;
      });
      onAssignedQuantitiesChange(newQtys);
    }
  };

  const updateShare = (personId: string, value: number) => {
    const clamped = Math.max(1, Math.round(value));
    onAssignedQuantitiesChange({ ...assignedQuantities, [personId]: clamped });
  };

  const totalShares = selectedPeople.reduce(
    (s, pid) => s + (assignedQuantities[pid] ?? 1),
    0
  );

  const hasAnnotations = !!getChipAnnotation;

  return (
    <div className="space-y-4">
      {/* Person chips */}
      <div className="flex flex-wrap gap-2 items-start">
        {allIds.length > 1 && (
          <button
            type="button"
            onClick={handleSelectEveryone}
            data-testid="button-select-everyone"
            className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium border transition-colors ${
              everyoneSelected
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover-elevate"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Everyone
          </button>
        )}
        {people.map((person) => {
          const annotation = getChipAnnotation?.(person.id);
          return (
            <div
              key={person.id}
              className={
                hasAnnotations
                  ? "flex flex-col items-center gap-0.5"
                  : undefined
              }
            >
              <PersonChip
                name={person.name}
                initials={getInitials(person.name)}
                color={person.color}
                selected={selectedPeople.includes(person.id)}
                onSelect={() => handleTogglePerson(person.id)}
              />
              {annotation}
            </div>
          );
        })}
        {addPersonSlot}
      </div>

      {/* Split mode — only when 2+ people selected */}
      {selectedPeople.length >= 2 && (
        <div className="space-y-2">
          <div className="flex justify-center">
            {splitMode === "equal" ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => handleSplitModeChange("share")}
                data-testid="button-split-share"
              >
                Not splitting equally? Adjust amounts
              </button>
            ) : (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => handleSplitModeChange("equal")}
                data-testid="button-split-equal"
              >
                Back to equal split
              </button>
            )}
          </div>

          {splitMode === "share" && (
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {selectedPeople.map((pid) => {
                const person = people.find((p) => p.id === pid);
                if (!person) return null;
                const weight = assignedQuantities[pid] ?? 1;
                const pct =
                  totalShares > 0
                    ? Math.round((weight / totalShares) * 100)
                    : 0;
                return (
                  <div key={pid} className="flex items-center gap-2 px-3 py-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                      style={{ backgroundColor: person.color }}
                    >
                      {getInitials(person.name)}
                    </div>
                    <span className="flex-1 text-sm truncate">{person.name}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                      {pct}%
                    </span>
                    <div className="flex items-center gap-1.5 ml-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateShare(pid, weight - 1)}
                        disabled={weight <= 1}
                        data-testid={`button-share-minus-${pid}`}
                      >
                        <span className="text-base leading-none select-none">
                          −
                        </span>
                      </Button>
                      <span
                        className="w-6 text-center text-sm font-semibold tabular-nums"
                        data-testid={`text-share-${pid}`}
                      >
                        {weight}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateShare(pid, weight + 1)}
                        data-testid={`button-share-plus-${pid}`}
                      >
                        <span className="text-base leading-none select-none">
                          +
                        </span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
