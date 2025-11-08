import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RegularPersonCard from "@/components/RegularPersonCard";
import BottomSheet from "@/components/BottomSheet";
import { Search, Plus } from "lucide-react";

interface Person {
  id: string;
  name: string;
  initials: string;
  phone?: string;
  email?: string;
}

export default function RegularsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");

  const [people, setPeople] = useState<Person[]>([
    { id: "1", name: "John Doe", initials: "JD", phone: "+1 555-0123", email: "john@example.com" },
    { id: "2", name: "Sarah Miller", initials: "SM", phone: "+1 555-0456" },
    { id: "3", name: "Alex Brown", initials: "AB", phone: "+1 555-0789", email: "alex@example.com" },
    { id: "4", name: "Emma Wilson", initials: "EW", phone: "+1 555-0321" }
  ]);

  const filteredPeople = people.filter(p => 
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      const newPerson: Person = {
        id: Date.now().toString(),
        name: newPersonName.trim(),
        initials: getInitials(newPersonName.trim()),
        phone: newPersonPhone.trim() || undefined,
        email: newPersonEmail.trim() || undefined
      };
      setPeople([...people, newPerson]);
      setNewPersonName("");
      setNewPersonPhone("");
      setNewPersonEmail("");
      setAddPersonOpen(false);
    }
  };

  const handleRemovePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Regulars</h1>
          <Button 
            size="icon"
            onClick={() => setAddPersonOpen(true)}
            data-testid="button-add-person"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filteredPeople.map((person) => (
            <RegularPersonCard
              key={person.id}
              {...person}
              onSelect={() => console.log('Selected', person.name)}
              onRemove={() => handleRemovePerson(person.id)}
            />
          ))}
          {filteredPeople.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No people found</p>
            </div>
          )}
        </div>
      </main>

      <BottomSheet
        open={addPersonOpen}
        onClose={() => {
          setAddPersonOpen(false);
          setNewPersonName("");
          setNewPersonPhone("");
          setNewPersonEmail("");
        }}
        title="Add Person"
        footer={
          <Button 
            className="w-full" 
            onClick={handleAddPerson}
            disabled={!newPersonName.trim()}
            data-testid="button-save-person"
          >
            Add Person
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Name *</label>
            <Input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="John Doe"
              data-testid="input-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Phone</label>
            <Input
              type="tel"
              value={newPersonPhone}
              onChange={(e) => setNewPersonPhone(e.target.value)}
              placeholder="+1 555-0123"
              data-testid="input-phone"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <Input
              type="email"
              value={newPersonEmail}
              onChange={(e) => setNewPersonEmail(e.target.value)}
              placeholder="john@example.com"
              data-testid="input-email"
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
