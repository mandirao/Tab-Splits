import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonSummaryCard from "@/components/PersonSummaryCard";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const PERSON_COLORS = [
  'hsl(330, 75%, 65%)',
  'hsl(340, 80%, 60%)',
  'hsl(25, 90%, 62%)',
  'hsl(15, 85%, 65%)',
];

export default function SummaryPage() {
  const [, setLocation] = useLocation();

  const mockPeopleSummaries = [
    {
      id: "1",
      name: "John Doe",
      initials: "JD",
      color: PERSON_COLORS[0],
      items: [
        { name: "Margherita Pizza", quantity: 1, price: 12.00 },
        { name: "House Wine", quantity: 1, price: 8.00 }
      ],
      subtotal: 20.00,
      taxShare: 1.80,
      tipShare: 4.00,
      total: 25.80
    },
    {
      id: "2",
      name: "Sarah Miller",
      initials: "SM",
      color: PERSON_COLORS[1],
      items: [
        { name: "Margherita Pizza", quantity: 1, price: 12.00 }
      ],
      subtotal: 12.00,
      taxShare: 1.08,
      tipShare: 2.40,
      total: 15.48
    },
    {
      id: "3",
      name: "Alex Brown",
      initials: "AB",
      color: PERSON_COLORS[2],
      items: [
        { name: "Caesar Salad", quantity: 1, price: 12.50 }
      ],
      subtotal: 12.50,
      taxShare: 1.13,
      tipShare: 2.50,
      total: 16.13
    },
    {
      id: "4",
      name: "Emma Wilson",
      initials: "EW",
      color: PERSON_COLORS[3],
      items: [
        { name: "House Wine", quantity: 1, price: 8.00 }
      ],
      subtotal: 8.00,
      taxShare: 0.72,
      tipShare: 1.60,
      total: 10.32
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center gap-3 mb-3">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setLocation("/receipt/1")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Summary</h1>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Tabs defaultValue="all" className="h-full flex flex-col">
          <TabsList className="w-full rounded-none border-b bg-card px-4">
            <TabsTrigger value="all" className="flex-1" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="by-person" className="flex-1" data-testid="tab-by-person">By Person</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="flex-1 overflow-y-auto p-4 mt-0">
            <div className="space-y-4">
              {mockPeopleSummaries.map((person) => (
                <PersonSummaryCard
                  key={person.id}
                  {...person}
                  onShare={() => console.log('Share to', person.name)}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="by-person" className="flex-1 overflow-y-auto p-4 mt-0">
            <div className="space-y-4">
              {mockPeopleSummaries.map((person) => (
                <PersonSummaryCard
                  key={person.id}
                  {...person}
                  onShare={() => console.log('Share to', person.name)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
