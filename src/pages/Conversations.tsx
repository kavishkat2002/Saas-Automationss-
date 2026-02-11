import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export default function Conversations() {
  const { businessId } = useBusiness();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, customers(name, phone)")
        .eq("business_id", businessId!)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Conversations</h1>
        <p className="text-muted-foreground mt-1">WhatsApp conversations with customers</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !conversations?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Conversations will appear here once your WhatsApp integration is active.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{(c.customers as any)?.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{(c.customers as any)?.phone || "No phone"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.is_human_takeover && <Badge variant="outline">Human</Badge>}
                  <Badge variant={c.status === "active" ? "default" : c.status === "escalated" ? "destructive" : "secondary"}>{c.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
