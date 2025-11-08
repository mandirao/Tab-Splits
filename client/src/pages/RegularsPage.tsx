import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RegularPersonCard from "@/components/RegularPersonCard";
import BottomSheet from "@/components/BottomSheet";
import { Search, Plus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Person } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PERSON_COLORS = [
  'hsl(330, 75%, 65%)',
  'hsl(340, 80%, 60%)',
  'hsl(25, 90%, 62%)',
  'hsl(15, 85%, 65%)',
  'hsl(45, 95%, 65%)',
  'hsl(185, 65%, 70%)',
  'hsl(195, 70%, 65%)',
  'hsl(280, 55%, 68%)',
  'hsl(270, 60%, 70%)',
  'hsl(35, 85%, 68%)',
];

export default function RegularsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string }) => {
      return await apiRequest("/api/people", "POST", {
        ...data,
        isRegular: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Person added to regulars" });
      setNewPersonName("");
      setNewPersonPhone("");
      setNewPersonEmail("");
      setAddPersonOpen(false);
    }
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/people/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Person removed from regulars" });
    }
  });

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

  const getColorForPerson = (index: number) => {
    return PERSON_COLORS[index % PERSON_COLORS.length];
  };

  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      createPersonMutation.mutate({
        name: newPersonName.trim(),
        phone: newPersonPhone.trim() || undefined,
        email: newPersonEmail.trim() || undefined
      });
    }
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
          {filteredPeople.map((person, idx) => (
            <RegularPersonCard
              key={person.id}
              name={person.name}
              initials={getInitials(person.name)}
              color={getColorForPerson(idx)}
              phone={person.phone || undefined}
              email={person.email || undefined}
              onSelect={() => console.log('Selected', person.name)}
              onRemove={() => deletePersonMutation.mutate(person.id)}
            />
          ))}
          {filteredPeople.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No people found</p>
              <p className="text-sm mt-2">Add your dining regulars to quickly assign items</p>
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
            disabled={!newPersonName.trim() || createPersonMutation.isPending}
            data-testid="button-save-person"
          >
            {createPersonMutation.isPending ? "Adding..." : "Add Person"}
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
