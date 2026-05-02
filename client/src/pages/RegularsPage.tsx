import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RegularPersonCard from "@/components/RegularPersonCard";
import BottomSheet from "@/components/BottomSheet";
import { Search, Plus, Phone, UserPlus, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Person } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/categories";

const PERSON_COLORS = [
  'hsl(38, 92%, 50%)',   // Amber
  'hsl(17, 81%, 53%)',   // Coral
  'hsl(345, 77%, 57%)',  // Raspberry
  'hsl(258, 90%, 66%)',  // Violet
  'hsl(217, 91%, 60%)',  // Blue
  'hsl(164, 87%, 39%)',  // Teal
  'hsl(142, 71%, 45%)',  // Lime
  'hsl(330, 81%, 60%)',  // Pink
];

type AddMode = "contacts" | "manual";

export default function RegularsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("contacts");

  // Contact mode state
  const [pendingContact, setPendingContact] = useState<{ name: string; phone: string } | null>(null);

  // Manual mode state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const firstNameRef = useRef<HTMLInputElement>(null);

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string }) => {
      return await apiRequest("/api/people", "POST", { ...data, isRegular: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Diner added" });
      resetAndClose();
    },
    onError: (err: any) => {
      toast({ title: "Could not add diner", description: err.message, variant: "destructive" });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/people/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Diner removed" });
    },
  });

  const filteredPeople = people.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const getColorForPerson = (index: number) =>
    PERSON_COLORS[index % PERSON_COLORS.length];

  const resetAndClose = () => {
    setAddPersonOpen(false);
    setPendingContact(null);
    setFirstName("");
    setLastName("");
    setPhone("");
  };

  const openSheet = () => {
    const contactsSupported = "contacts" in navigator && "ContactsManager" in window;
    setAddMode(contactsSupported ? "contacts" : "manual");
    setAddPersonOpen(true);
  };

  const handleOpenContacts = async () => {
    try {
      const contacts = await (navigator as any).contacts.select(["name", "tel"], { multiple: false });
      if (contacts?.length > 0) {
        const c = contacts[0];
        setPendingContact({
          name: c.name?.[0] ?? "",
          phone: c.tel?.[0] ?? "",
        });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Could not open contacts", description: "Try adding manually instead.", variant: "destructive" });
      }
    }
  };

  const handleAddFromContact = () => {
    if (!pendingContact?.name) return;
    createPersonMutation.mutate({
      name: pendingContact.name,
      ...(pendingContact.phone ? { phone: pendingContact.phone } : {}),
    });
  };

  const handleAddManually = () => {
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!name) return;
    createPersonMutation.mutate({ name, ...(phone.trim() ? { phone: phone.trim() } : {}) });
  };

  const isBusy = createPersonMutation.isPending;
  const contactsSupported = "contacts" in navigator && "ContactsManager" in window;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card space-y-3">
        <h1 className="text-2xl font-bold">Regulars</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search regulars…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <Button
          className="w-full"
          onClick={openSheet}
          data-testid="button-add-person"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Diner
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filteredPeople.map((person, idx) => (
            <RegularPersonCard
              key={person.id}
              name={person.name}
              initials={getInitials(person.name)}
              color={getColorForPerson(idx)}
              phone={person.phone || undefined}
              email={person.email || undefined}
              onSelect={() => {}}
              onRemove={() => deletePersonMutation.mutate(person.id)}
            />
          ))}
          {filteredPeople.length === 0 && !searchQuery && (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <p className="font-medium text-foreground">No regulars yet</p>
              <p className="text-sm">Add your dining crew so they're ready to split any bill</p>
              <Button variant="outline" onClick={openSheet} data-testid="button-add-person-empty">
                <Plus className="h-4 w-4 mr-2" />
                Add your first diner
              </Button>
            </div>
          )}
          {filteredPeople.length === 0 && searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No diners match "{searchQuery}"</p>
            </div>
          )}
        </div>
      </main>

      <BottomSheet
        open={addPersonOpen}
        onClose={resetAndClose}
        title="Add Diner"
      >
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-muted rounded-md p-1">
            {[
              { id: "contacts" as const, label: "From Contacts", icon: Phone },
              { id: "manual" as const, label: "Manual", icon: UserPlus },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAddMode(id);
                  setPendingContact(null);
                  setFirstName(""); setLastName(""); setPhone("");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded transition-colors ${
                  addMode === id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground"
                }`}
                data-testid={`button-add-mode-${id}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Contacts mode */}
          {addMode === "contacts" && (
            <div className="space-y-3">
              {pendingContact ? (
                <>
                  {/* Preview card */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {getInitials(pendingContact.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pendingContact.name}</p>
                      {pendingContact.phone && (
                        <p className="text-xs text-muted-foreground">{pendingContact.phone}</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPendingContact(null)}
                      data-testid="button-clear-contact"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleAddFromContact}
                    disabled={!pendingContact.name || isBusy}
                    data-testid="button-add-contact"
                  >
                    {isBusy ? "Adding…" : `Add ${pendingContact.name.split(" ")[0]}`}
                  </Button>
                </>
              ) : contactsSupported ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleOpenContacts}
                  data-testid="button-open-contacts"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Choose from Contacts
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Contact picking isn't supported in this browser. Switch to Manual to add someone.
                </p>
              )}
            </div>
          )}

          {/* Manual mode */}
          {addMode === "manual" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="reg-first" className="text-xs">First name *</Label>
                  <Input
                    id="reg-first"
                    ref={firstNameRef}
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="mt-1"
                    onKeyDown={e => { if (e.key === "Enter") handleAddManually(); }}
                    data-testid="input-add-first"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="reg-last" className="text-xs">Last name</Label>
                  <Input
                    id="reg-last"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Chen"
                    className="mt-1"
                    data-testid="input-add-last"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="reg-phone" className="text-xs">Phone <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                  data-testid="input-add-phone"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAddManually}
                disabled={!firstName.trim() || isBusy}
                data-testid="button-add-manual"
              >
                {isBusy ? "Adding…" : "Add Diner"}
              </Button>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
