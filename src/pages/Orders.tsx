import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2, Eye, Truck, Package, CheckCircle, ShoppingBag } from "lucide-react";
import { logAiOrderCompletion, classifyCustomerValue } from "@/lib/ai-activity";

const statusVariant = (s: string) => {
  switch (s) {
    case "delivered": return "default";
    case "shipped": return "secondary";
    case "confirmed": return "outline";
    case "cancelled": return "destructive";
    case "packed": return "secondary";
    case "ready_for_pickup": return "secondary";
    case "out_for_delivery": return "default";
    default: return "secondary";
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case "pending": return "Pending";
    case "confirmed": return "Confirmed";
    case "packed": return "Order Packed";
    case "ready_for_pickup": return "Ready for Pickup";
    case "out_for_delivery": return "Out for Delivery";
    case "shipped": return "Shipped";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
    default: return s;
  }
};

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export default function Orders() {
  const { businessId } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [customerId, setCustomerId] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Manage Order State
  const [newStatus, setNewStatus] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(name, phone, address, email), order_items(*)")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const { data: products } = useQuery({
    queryKey: ["products", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!customerId || orderItems.length === 0) {
        throw new Error("Please select a customer and add at least one product");
      }

      const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          business_id: businessId!,
          customer_id: customerId,
          total_amount: totalAmount,
          status: "pending",
          payment_status: "unpaid",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(
          orderItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
          }))
        );

      if (itemsError) throw itemsError;

      // Update customer stats
      const customer = customers?.find(c => c.id === customerId);
      if (customer) {
        const newTotalSpent = Number(customer.total_spent || 0) + totalAmount;
        const newOrderCount = (customer.order_count || 0) + 1;

        await supabase
          .from("customers")
          .update({
            total_spent: newTotalSpent,
            order_count: newOrderCount,
          })
          .eq("id", customerId);

        // AI: Classify customer value
        await classifyCustomerValue(businessId!, customerId, newTotalSpent);
      }

      // AI: Log order completion
      await logAiOrderCompletion(businessId!, order.id, totalAmount);

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Order created successfully!" });
      setCreateOpen(false);
      setCustomerId("");
      setOrderItems([]);
      setSelectedProduct("");
      setQuantity("1");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async () => {
      if (!selectedOrder || !newStatus) return;

      // Update order status in DB
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      // Trigger Notification Notification
      try {
        await supabase.functions.invoke('send-order-notification', {
          body: {
            order_id: selectedOrder.id,
            status: newStatus,
            custom_message: customMessage
          }
        });
      } catch (err) {
        console.error("Failed to send notification:", err);
        // Don't throw here to allow status update to succeed even if notification fails
        toast({ title: "Status updated", description: "Notification failed to send." });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order status updated", description: "Customer has been notified." });
      setManageOpen(false);
      setCustomMessage("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteOrder = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return;
      const { error } = await supabase.from("orders").delete().eq("id", selectedOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order deleted" });
      setManageOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addProductToOrder = () => {
    if (!selectedProduct) return;
    const product = products?.find(p => p.id === selectedProduct);
    if (!product) return;
    const existingItem = orderItems.find(item => item.product_id === selectedProduct);
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.product_id === selectedProduct
          ? { ...item, quantity: item.quantity + parseInt(quantity) }
          : item
      ));
    } else {
      setOrderItems([
        ...orderItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: parseInt(quantity),
          unit_price: Number(product.price),
        },
      ]);
    }
    setSelectedProduct("");
    setQuantity("1");
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product_id !== productId));
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const openManageDialog = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setCustomMessage("");
    setManageOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Orders</h1>
          <p className="text-muted-foreground mt-1">Track and manage orders</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Add Products</Label>
                <div className="flex gap-2">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - Rs. {Number(p.price).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-20"
                    placeholder="Qty"
                  />
                  <Button type="button" onClick={addProductToOrder} variant="secondary">
                    Add
                  </Button>
                </div>
              </div>

              {orderItems.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  <Label>Order Items</Label>
                  {orderItems.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × Rs. {item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-medium">Rs. {(item.quantity * item.unit_price).toFixed(2)}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.product_id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-lg font-bold">
                    <span>Total:</span>
                    <span>Rs. {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={() => createOrder.mutate()}
                disabled={createOrder.isPending || !customerId || orderItems.length === 0}
                className="w-full"
              >
                {createOrder.isPending ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manage Order Dialog */}
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage Order #{selectedOrder?.id?.slice(0, 8)}</DialogTitle>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Customer Details */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Eye className="h-4 w-4" /> Customer Details</h3>
                <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                  <p><span className="font-medium">Name:</span> {selectedOrder?.customers?.name}</p>
                  <p><span className="font-medium">Phone:</span> {selectedOrder?.customers?.phone || "—"}</p>
                  <p><span className="font-medium">Email:</span> {selectedOrder?.customers?.email || "—"}</p>
                  <p><span className="font-medium">Address:</span> {selectedOrder?.shipping_address || selectedOrder?.customers?.address || "—"}</p>
                </div>

                <h3 className="font-semibold flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Order Items</h3>
                <div className="border rounded-lg p-2 max-h-40 overflow-y-auto">
                  <Table>
                    <TableBody>
                      {selectedOrder?.order_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="py-2">{item.product_name}</TableCell>
                          <TableCell className="py-2 text-right">{item.quantity}x</TableCell>
                          <TableCell className="py-2 text-right">Rs. {item.total_price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between font-bold text-lg px-2">
                  <span>Total</span>
                  <span>Rs. {selectedOrder?.total_amount}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Update Status</h3>
                <div className="space-y-3">
                  <Label>Order Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                      <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                      <SelectItem value="packed">📦 Checked / Packed</SelectItem>
                      <SelectItem value="ready_for_pickup">🛍️ Ready for Collection</SelectItem>
                      <SelectItem value="out_for_delivery">🚚 Out for Delivery / Handed Over</SelectItem>
                      <SelectItem value="shipped">🚚 Shipped</SelectItem>
                      <SelectItem value="delivered">🎉 Delivered</SelectItem>
                      <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label>Custom Message to Customer</Label>
                  <Textarea
                    placeholder="Add a custom note (optional)... e.g., 'Your order is packed with care!'"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                  />

                  <Button
                    className="w-full"
                    onClick={() => updateOrderStatus.mutate()}
                    disabled={updateOrderStatus.isPending}
                  >
                    {updateOrderStatus.isPending ? "Updating & Notifying..." : "Update Status & Notify"}
                  </Button>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
                  <Button variant="destructive" className="w-full" onClick={() => deleteOrder.mutate()} disabled={deleteOrder.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Order
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !orders?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet. Create your first order!</TableCell></TableRow>
              ) : orders.map(o => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openManageDialog(o)}>
                  <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{(o.customers as any)?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{(o.customers as any)?.phone || ""}</div>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge></TableCell>
                  <TableCell><Badge variant={o.payment_status === "paid" ? "default" : "outline"}>{o.payment_status}</Badge></TableCell>
                  <TableCell>Rs. {Number(o.total_amount).toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(o.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openManageDialog(o); }}>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
