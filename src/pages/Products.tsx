import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Search, Plus, Image as ImageIcon, Pencil, Trash2, MoreHorizontal, 
  CheckCircle, Wallet, ShoppingCart, Package
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Products() {
  const { user } = useAuth();
  const canUpdate = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'sales';
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { toast } = useToast();

  const [newProduct, setNewProduct] = useState({
    brand: "", price: "", category: "", stock: "1", description: "",
    purchase_price: "0", transport_cost: "0", additional_cost: "0", service_fee: "0"
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Sale tracking state
  const [isSelling, setIsSelling] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [newSale, setNewSale] = useState({
    lead_id: "", selling_price: "", sale_date: new Date().toISOString().split('T')[0], account: "Bank"
  });

  const fetchProducts = () => {
    fetch("http://localhost:5001/api/products")
      .then(res => res.json())
      .then(data => { setProducts(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  };

  const fetchLeads = () => {
    fetch("http://localhost:5001/api/leads")
      .then(res => res.json())
      .then(data => setLeads((data || []).filter((l: any) => l.status !== 'Closed')))
      .catch(console.error);
  };

  useEffect(() => { 
    fetchProducts(); 
    if (canUpdate) fetchLeads();
  }, [canUpdate]);

  const handleMarkSold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !newSale.lead_id) return;
    try {
      const res = await fetch("http://localhost:5001/api/finance/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          lead_id: newSale.lead_id,
          selling_price: newSale.selling_price || selectedProduct.price,
          sale_date: newSale.sale_date,
          payment_method: "Bank",
          account: newSale.account
        })
      });
      if (res.ok) {
        toast({ title: "Sale Verified", description: "Finance ledger updated & stock reduced." });
        setIsSelling(false);
        fetchProducts();
      }
    } catch (err) { console.error(err); }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    const formData = new FormData();
    formData.append("brand", newProduct.brand);
    formData.append("price", newProduct.price);
    formData.append("category", newProduct.category);
    formData.append("stock", newProduct.stock);
    formData.append("description", newProduct.description);
    formData.append("purchase_price", newProduct.purchase_price);
    formData.append("transport_cost", newProduct.transport_cost);
    formData.append("repair_cost", newProduct.additional_cost);
    formData.append("registration_fee", newProduct.service_fee);
    if (imageFile) {
      formData.append("image", imageFile);
    } else if (editingProduct && editingProduct.image_url) {
      formData.append("existing_image", editingProduct.image_url);
    }

    try {
      const url = editingProduct 
        ? `http://localhost:5001/api/products/${editingProduct.id}`
        : "http://localhost:5001/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: formData,
      });
      if (res.ok) {
        toast({ title: "Success", description: editingProduct ? "Product updated successfully!" : "Product added successfully!" });
        setIsOpen(false);
        setEditingProduct(null);
        setNewProduct({ 
          brand: "", price: "", category: "", stock: "1", description: "",
          purchase_price: "0", transport_cost: "0", additional_cost: "0", service_fee: "0"
        });
        setImageFile(null);
        fetchProducts();
      } else {
        const error = await res.json();
        toast({ title: "Failed", description: error.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
    setIsAdding(false);
  };

  const handleEditProduct = (p: any) => {
    setEditingProduct(p);
    setNewProduct({
      brand: p.brand,
      price: p.price.toString(),
      category: p.category || "",
      stock: p.stock.toString(),
      description: p.description || "",
      purchase_price: (p.purchase_price || 0).toString(),
      transport_cost: (p.transport_cost || 0).toString(),
      additional_cost: (p.repair_cost || 0).toString(),
      service_fee: (p.registration_fee || 0).toString()
    });
    setIsOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`http://localhost:5001/api/products/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast({ title: "Deleted", description: "Product removed successfully." });
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = products.filter(p => 
    p.brand.toLowerCase().includes(search.toLowerCase()) || 
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">Product Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your item stock, pricing, and availability.</p>
        </div>
        
        {canUpdate && (
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
              setEditingProduct(null);
              setNewProduct({ 
                brand: "", price: "", category: "", stock: "1", description: "",
                purchase_price: "0", transport_cost: "0", additional_cost: "0", service_fee: "0"
              });
              setImageFile(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary/90 text-sm h-9 px-4 shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-3.5 w-3.5" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
                <DialogDescription>
                  {editingProduct ? "Update the items details below." : "Enter product details and upload a photo."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name / Brand</Label>
                    <Input required value={newProduct.brand} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} placeholder="e.g. MacBook Pro" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Price (Rs.)</Label>
                    <Input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} placeholder="250000" className="h-9 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} placeholder="Electronics" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stock Quantity</Label>
                    <Input type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
                  <Input value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Product specifications..." className="h-9 text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold text-emerald-600">Purchase Cost</Label>
                    <Input type="number" value={newProduct.purchase_price} onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Additional Cost</Label>
                    <Input type="number" value={newProduct.additional_cost} onChange={e => setNewProduct({...newProduct, additional_cost: e.target.value})} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Shipping / Trans.</Label>
                    <Input type="number" value={newProduct.transport_cost} onChange={e => setNewProduct({...newProduct, transport_cost: e.target.value})} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Service Fee / Tax</Label>
                    <Input type="number" value={newProduct.service_fee} onChange={e => setNewProduct({...newProduct, service_fee: e.target.value})} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Product Image</Label>
                  <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-sm" />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="text-sm h-9">Cancel</Button>
                  <Button type="submit" disabled={isAdding} className="bg-primary text-white hover:bg-primary/90 text-sm h-9">
                    {isAdding && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save Product
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative w-full md:max-w-xs">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
             <Input placeholder="Search products..." className="pl-9 h-9 text-sm bg-background border-border" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-background/50">
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider w-[80px]">Image</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Product / Brand</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</TableHead>
                {canUpdate && <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-16 text-sm text-muted-foreground">No products found.</TableCell></TableRow>
              ) : (
                filtered.map(p => (
                   <TableRow key={p.id} className="hover:bg-primary/[0.02] transition-colors border-border">
                    <TableCell>
                      {p.image_url ? (
                        <img src={`http://localhost:5001${p.image_url}`} alt="product" className="w-14 h-10 object-cover rounded-md border border-border" />
                      ) : (
                        <div className="w-14 h-10 bg-primary/5 rounded-md border border-border flex items-center justify-center">
                          <Package className="h-5 w-5 opacity-20" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{p.brand}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.category || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-medium rounded-md px-2 py-0.5 border-border text-muted-foreground">
                        {p.stock} in stock
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-foreground">Rs. {Number(p.price).toLocaleString()}</TableCell>
                    {canUpdate && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="w-48">
                             {p.stock > 0 && (
                               <DropdownMenuItem onClick={() => { setSelectedProduct(p); setNewSale(prev => ({...prev, selling_price: p.price.toString()})); setIsSelling(true); }} className="text-xs gap-2 text-emerald-600 font-bold focus:text-emerald-600">
                                 <ShoppingCart className="h-3 w-3" /> Mark as Sold
                               </DropdownMenuItem>
                             )}
                             <DropdownMenuItem onClick={() => handleEditProduct(p)} className="text-xs gap-2">
                               <Pencil className="h-3 w-3" /> Edit Details
                             </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => handleDeleteProduct(p.id)} className="text-xs gap-2 text-rose-600 focus:text-rose-600">
                               <Trash2 className="h-3 w-3" /> Delete Item
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Sale Confirmation Dialog */}
      <Dialog open={isSelling} onOpenChange={setIsSelling}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display">Finalize Sale</DialogTitle>
            <DialogDescription>Mark {selectedProduct?.brand} as sold and record revenue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMarkSold} className="space-y-4 py-4">
             <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Select Buyer (Lead)</Label>
                <Select value={newSale.lead_id} onValueChange={v => setNewSale({...newSale, lead_id: v})}>
                   <SelectTrigger><SelectValue placeholder="Link this sale to a lead" /></SelectTrigger>
                   <SelectContent>
                      {leads.map(l => (
                         <SelectItem key={l.id} value={l.id.toString()}>{l.name} ({l.phone})</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Final Selling Price (Rs.)</Label>
                <Input type="number" value={newSale.selling_price} onChange={e => setNewSale({...newSale, selling_price: e.target.value})} className="h-9" />
             </div>
             <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Deposit to Account</Label>
                <Select value={newSale.account} onValueChange={v => setNewSale({...newSale, account: v})}>
                   <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="Bank">Bank Account</SelectItem>
                      <SelectItem value="Cash">Cash Drawer</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsSelling(false)} className="h-9">Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">Confirm Sale</Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
