import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="flex flex-col gap-6 w-full max-w-sm">
        <div className="flex flex-col gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" isLoading>
            Loading
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Input placeholder="Plain input" />
          <Input placeholder="With icon" icon={<Search size={14} />} />
        </div>
      </div>
    </div>
  );
}
