import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Disc3 } from "lucide-react";

export default function Index() {
  const [handle, setHandle] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      navigate(`/user/${encodeURIComponent(handle.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 text-center">
        <Disc3 className="mx-auto mb-4 h-14 w-14 text-primary animate-spin" style={{ animationDuration: "3s" }} />
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
          ​teal.fm stats 
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          enter a bluesky handle that uses teal.fm to track music plays              
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="handle.bsky.social"
            className="flex-1 bg-card border-border" />

          <Button type="submit" disabled={!handle.trim()}>
            View
          </Button>
        </form>
      </div>
    </div>);

}