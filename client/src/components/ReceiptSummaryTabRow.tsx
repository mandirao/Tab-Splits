import { useEffect, useRef } from "react";
import type { PersonWithColor } from "@/lib/receiptSummary";

export default function ReceiptSummaryTabRow({
  people,
  displayNames,
  selectedTab,
  onSelectTab,
}: {
  people: PersonWithColor[];
  displayNames: Map<string, string>;
  selectedTab: string;
  onSelectTab: (id: string) => void;
}) {
  const tabRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tabRowRef.current) return;
    const active = tabRowRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedTab]);

  return (
    <div className="sticky top-[73px] z-40 bg-background border-b">
      <div ref={tabRowRef} className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-2">
        <button
          data-active={selectedTab === "all"}
          onClick={() => onSelectTab("all")}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            selectedTab === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover-elevate"
          }`}
          data-testid="tab-all"
        >
          All
        </button>

        {people.map(person => {
          const isActive = selectedTab === person.id;
          return (
            <button
              key={person.id}
              data-active={isActive}
              onClick={() => onSelectTab(person.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                isActive ? "text-white" : "border-border text-muted-foreground hover-elevate"
              }`}
              style={isActive ? { backgroundColor: person.color, borderColor: person.color } : undefined}
              data-testid={`tab-person-${person.id}`}
            >
              {!isActive && (
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: person.color }} />
              )}
              {displayNames.get(person.id) ?? person.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
