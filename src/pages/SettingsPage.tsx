import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, MessageSquare, CreditCard, Users } from "lucide-react";

export default function SettingsPage() {
  const { business, userRole } = useBusiness();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const updateBusiness = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("businesses").update({
        name: name || business?.name,
        contact_email: contactEmail || business?.contact_email,
      }).eq("id", business!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business"] }); toast({ title: "Settings updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your business configuration</p>
      </div>

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business" className="gap-2"><Building2 className="h-4 w-4" />Business</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" />WhatsApp</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2"><CreditCard className="h-4 w-4" />Plans</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" />Team</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Business Profile</CardTitle>
              <CardDescription>Update your business information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input defaultValue={business?.name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" defaultValue={business?.contact_email || ""} onChange={e => setContactEmail(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Label>Your Role:</Label>
                <Badge>{userRole || "—"}</Badge>
              </div>
              {userRole === "owner" && (
                <Button onClick={() => updateBusiness.mutate()} disabled={updateBusiness.isPending}>Save Changes</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">WhatsApp Configuration</CardTitle>
              <CardDescription>Configure your WhatsApp Business API integration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">WhatsApp integration settings will be available once you connect your provider. Contact support for setup assistance.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: "Starter", price: "$29", features: ["WhatsApp automation", "Basic analytics", "Up to 500 customers"] },
              { name: "Growth", price: "$79", features: ["AI recommendations", "Advanced analytics", "Unlimited customers", "Priority support"] },
              { name: "Pro", price: "$199", features: ["Demand prediction", "Voice AI readiness", "Dedicated support", "Custom integrations"] },
            ].map(plan => (
              <Card key={plan.name} className={plan.name === "Growth" ? "border-primary shadow-lg" : ""}>
                <CardHeader>
                  <CardTitle className="font-display">{plan.name}</CardTitle>
                  <p className="text-3xl font-display font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant={plan.name === "Growth" ? "default" : "outline"} className="w-full mt-4">
                    {plan.name === "Growth" ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Team Members</CardTitle>
              <CardDescription>Manage team access and roles</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Team management features coming soon. You'll be able to invite admins and agents to your business.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
