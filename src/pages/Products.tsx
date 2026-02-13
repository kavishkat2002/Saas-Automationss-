import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";

export default function Products() {
  const { businessId } = useBusiness();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    currency: "Rs",
    category: "",
    stock_quantity: "",
    stock_unit: "Quantity",
    description: "",
    image_url: ""
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = useMutation({
    mutationFn: async () => {
      let imageUrl = form.image_url;

      if (imageFile) {
        try {
          imageUrl = await uploadImage(imageFile);
        } catch (error: any) {
          console.error("Image upload failed:", error);
          throw new Error(`Image upload failed: ${error.message}`);
        }
      }

      const productData = {
        business_id: businessId!,
        name: form.name,
        price: parseFloat(form.price) || 0,
        currency: form.currency,
        category: form.category || null,
        stock_quantity: parseFloat(form.stock_quantity) || 0,
        stock_unit: form.stock_unit,
        description: form.description || null,
        image_url: imageUrl || null,
      };

      if (isEditing && currentId) {
        const { error } = await supabase.from("products").update(productData).eq("id", currentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(productData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: isEditing ? "Product updated" : "Product added" });
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({
      name: "",
      price: "",
      currency: "Rs",
      category: "",
      stock_quantity: "",
      stock_unit: "Quantity",
      description: "",
      image_url: ""
    });
    setImageFile(null);
    setIsEditing(false);
    setCurrentId(null);
  };

  const handeEditClick = (product: any) => {
    setForm({
      name: product.name,
      price: product.price.toString(),
      currency: product.currency || "Rs",
      category: product.category || "",
      stock_quantity: product.stock_quantity.toString(),
      stock_unit: product.stock_unit || "Quantity",
      description: product.description || "",
      image_url: product.image_url || ""
    });
    setCurrentId(product.id);
    setIsEditing(true);
    setOpen(true);
  };

  const filtered = products?.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleSave.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Product Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Organic Avocados" />
                </div>

                <div className="space-y-2">
                  <Label>Price</Label>
                  <div className="flex gap-2">
                    <Select value={form.currency} onValueChange={val => setForm({ ...form, currency: val })}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rs">Rs</SelectItem>
                        <SelectItem value="$">$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Vegetables" />
                </div>

                <div className="space-y-2">
                  <Label>Stock</Label>
                  <div className="flex gap-2">
                    <Input type="number" step={form.stock_unit === "Kg" ? "0.001" : "1"} value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} placeholder="0" />
                    <Select value={form.stock_unit} onValueChange={val => setForm({ ...form, stock_unit: val })}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quantity">Qty</SelectItem>
                        <SelectItem value="Kg">Kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Image (Upload or URL)</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setImageFile(e.target.files[0]);
                          setForm({ ...form, image_url: "" }); // Clear URL if file selected
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">OR</span>
                    <Input
                      value={form.image_url}
                      onChange={e => { setForm({ ...form, image_url: e.target.value }); setImageFile(null); }}
                      placeholder="https://..."
                    />
                  </div>
                  {(imageFile || form.image_url) && (
                    <div className="mt-2 h-20 w-20 border rounded-md overflow-hidden relative">
                      {imageFile ? (
                        <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <img src={form.image_url} alt="Preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Product details..." />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full" disabled={handleSave.isPending}>
                  {handleSave.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isEditing ? "Update Product" : "Save Product"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products yet</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{p.description}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{p.category || "—"}</TableCell>
                  <TableCell>{p.currency || "Rs"} {Number(p.price).toFixed(2)}</TableCell>
                  <TableCell>{p.stock_quantity} {p.stock_unit || "Qty"}</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handeEditClick(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Are you sure?")) handleDelete.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
