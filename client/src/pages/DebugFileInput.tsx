import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function DebugFileInput() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="flex flex-col h-screen bg-background p-4">
      <header className="mb-6">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold mt-4">File Upload Diagnostic</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Testing if ANY file input works on this device
        </p>
      </header>

      <div className="space-y-8">
        <div className="border-2 border-dashed border-primary p-6 rounded-lg">
          <h2 className="font-semibold mb-4">Test 1: Plain File Input (Gallery)</h2>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
                alert(`SUCCESS! Selected: ${file.name}`);
              }
            }}
            className="block w-full text-sm"
          />
        </div>

        <div className="border-2 border-dashed border-primary p-6 rounded-lg">
          <h2 className="font-semibold mb-4">Test 2: Plain File Input (Camera)</h2>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
                alert(`SUCCESS! Captured: ${file.name}`);
              }
            }}
            className="block w-full text-sm"
          />
        </div>

        {selectedFile && (
          <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg">
            <p className="font-semibold text-green-800 dark:text-green-100">
              ✓ File selected: {selectedFile.name}
            </p>
            <p className="text-sm text-green-700 dark:text-green-200">
              Size: {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg text-sm">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Open in new tab" at the top of this preview</li>
            <li>Navigate to this page in the new tab</li>
            <li>Try both file inputs above</li>
            <li>Report which ones work (if any)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
