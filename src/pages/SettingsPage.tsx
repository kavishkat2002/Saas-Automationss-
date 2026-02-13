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
import { Building2, MessageSquare, CreditCard, Users, Banknote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const { business, userRole } = useBusiness();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankSwiftCode, setBankSwiftCode] = useState("");
  const [paymentGatewayLink, setPaymentGatewayLink] = useState("");
  const [paymentGatewayName, setPaymentGatewayName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");

  const updateBusiness = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("businesses").update({
        name: name || business?.name,
        contact_email: contactEmail || business?.contact_email,
        bank_name: bankName || business?.bank_name || null,
        bank_account_number: bankAccountNumber || business?.bank_account_number || null,
        bank_account_holder: bankAccountHolder || business?.bank_account_holder || null,
        bank_branch: bankBranch || business?.bank_branch || null,
        bank_swift_code: bankSwiftCode || business?.bank_swift_code || null,
        payment_gateway_link: paymentGatewayLink || business?.payment_gateway_link || null,
        payment_gateway_name: paymentGatewayName || business?.payment_gateway_name || null,
        business_type: businessType || (business as any)?.business_type || null,
        description: description || (business as any)?.description || null,
        contact_phone: whatsappPhone || business?.contact_phone || null,
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
          <TabsTrigger value="bank" className="gap-2"><Banknote className="h-4 w-4" />Bank & Payment</TabsTrigger>
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
                <Label>Business Type</Label>
                <Select onValueChange={setBusinessType} defaultValue={(business as any)?.business_type || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail Store</SelectItem>
                    <SelectItem value="restaurant">Restaurant / Cafe</SelectItem>
                    <SelectItem value="service">Service Provider</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description <span className="text-xs text-muted-foreground">(Used by AI to answer customers)</span></Label>
                <Textarea
                  placeholder="e.g. We sell fresh organic vegetables directly from farmers..."
                  defaultValue={(business as any)?.description || ""}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[100px]"
                />
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

        <TabsContent value="bank" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Bank Details</CardTitle>
                <CardDescription>Configure your bank account details to share with customers for payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    placeholder="e.g., Bank of America"
                    defaultValue={business?.bank_name || ""}
                    onChange={e => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Holder Name</Label>
                  <Input
                    placeholder="e.g., John's Business LLC"
                    defaultValue={business?.bank_account_holder || ""}
                    onChange={e => setBankAccountHolder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    placeholder="e.g., 1234567890"
                    defaultValue={business?.bank_account_number || ""}
                    onChange={e => setBankAccountNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Branch (Optional)</Label>
                  <Input
                    placeholder="e.g., Main Street Branch"
                    defaultValue={business?.bank_branch || ""}
                    onChange={e => setBankBranch(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SWIFT/BIC Code (Optional)</Label>
                  <Input
                    placeholder="e.g., BOFAUS3N"
                    defaultValue={business?.bank_swift_code || ""}
                    onChange={e => setBankSwiftCode(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display">Payment Gateway</CardTitle>
                <CardDescription>Configure payment gateway links to send to customers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Gateway Name</Label>
                  <Input
                    placeholder="e.g., PayPal, Stripe, Square"
                    defaultValue={business?.payment_gateway_name || ""}
                    onChange={e => setPaymentGatewayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Gateway Link</Label>
                  <Input
                    type="url"
                    placeholder="e.g., https://paypal.me/yourbusiness"
                    defaultValue={business?.payment_gateway_link || ""}
                    onChange={e => setPaymentGatewayLink(e.target.value)}
                  />
                </div>
                {userRole === "owner" && (
                  <Button onClick={() => updateBusiness.mutate()} disabled={updateBusiness.isPending}>
                    Save Payment Settings
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">WhatsApp Configuration</CardTitle>
              <CardDescription>Configure your WhatsApp Business API integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">Configure your WhatsApp contact details. The AI Bot will use this context.</p>
              <div className="space-y-2">
                <Label>WhatsApp Number (Contact Phone)</Label>
                <Input
                  placeholder="+1234567890"
                  defaultValue={business?.contact_phone || ""}
                  onChange={e => setWhatsappPhone(e.target.value)}
                />
              </div>
              {userRole === "owner" && (
                <Button onClick={() => updateBusiness.mutate()} disabled={updateBusiness.isPending}>Save WhatsApp Settings</Button>
              )}
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
