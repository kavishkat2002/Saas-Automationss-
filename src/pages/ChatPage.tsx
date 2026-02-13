
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, User, MoreVertical, Phone, Check, CheckCheck, Image as ImageIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
    const { businessId } = useBusiness();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Fetch Conversations (Left Sidebar)
    const { data: conversations, isLoading: loadingConvos } = useQuery({
        queryKey: ["conversations", businessId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("conversations")
                .select(`
          *,
          customers (
            id,
            name,
            name,
            phone
          )
        `)
                .eq("business_id", businessId!)
                .order("last_message_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!businessId,
    });

    // Fetch Messages for Selected Conversation
    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["messages", selectedConversationId],
        queryFn: async () => {
            if (!selectedConversationId) return [];
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", selectedConversationId)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedConversationId,
        refetchInterval: 3000,
    });

    // Apply real-time subscription for messages
    useEffect(() => {
        if (!selectedConversationId) return;
        const channel = supabase
            .channel(`chat-${selectedConversationId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConversationId}` },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
                    // Also update conversation list order
                    queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedConversationId, queryClient, businessId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Send Message Mutation
    const sendMessage = useMutation({
        mutationFn: async (text: string) => {
            if (!selectedConversationId || !text.trim()) return;

            // 1. Insert message
            const { error } = await supabase.from("messages").insert({
                conversation_id: selectedConversationId,
                business_id: businessId,
                sender_type: "human_agent",
                content: text,
                message_type: "text",
            });
            if (error) throw error;

            // 2. Update conversation timestamp & takeover status
            await supabase.from("conversations").update({
                last_message_at: new Date().toISOString(),
                is_human_takeover: true
            }).eq("id", selectedConversationId);

            // 3. (Optional) Trigger External API (WhatsApp/Telegram) via Edge Function
            // const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN"); // This won't work in client side.
            // In a real app, sending a message here should trigger an Edge Function 
            // that actually sends the message to Telegram/WhatsApp API. 
            // For now, we just insert into DB, and assume a separate background worker or trigger handles the actual sending if needed,
            // OR we call the edge function directly.

            // Sending via Edge Function (pseudo-code):
            // await supabase.functions.invoke('send-message', { body: { chatId, text } })
        },
        onSuccess: () => {
            setNewMessage("");
            queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
        },
    });

    const handleSend = () => {
        if (newMessage.trim()) {
            sendMessage.mutate(newMessage);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const deleteConversation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("conversations").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Conversation deleted" });
            setSelectedConversationId(null);
            setDeleteId(null);
            queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-4">
            {/* LEFT SIDEBAR: CONVERSATION LIST */}
            <Card className="w-1/3 min-w-[300px] flex flex-col p-0 overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="font-semibold text-lg">Chats</h2>
                    <Input placeholder="Search..." className="mt-2" />
                </div>
                <ScrollArea className="flex-1">
                    {loadingConvos ? (
                        <div className="p-4 text-center text-muted-foreground">Loading...</div>
                    ) : conversations?.map((c) => (
                        <div
                            key={c.id}
                            onClick={() => setSelectedConversationId(c.id)}
                            className={cn(
                                "flex items-start gap-3 p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                                selectedConversationId === c.id && "bg-muted"
                            )}
                        >
                            <Avatar>
                                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium truncate">{(c.customers as any)?.name || "Unknown"}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {c.last_message_at ? format(new Date(c.last_message_at), "MMM d, HH:mm") : ""}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                    Click to view messages...
                                </p>
                                {c.channel && <Badge variant="secondary" className="mt-2 text-[10px] h-4 px-1">{c.channel}</Badge>}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </ScrollArea>
            </Card>

            {/* RIGHT SIDE: CHAT WINDOW */}
            <Card className="flex-1 flex flex-col overflow-hidden p-0">
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-card">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold">{(selectedConversation.customers as any)?.name || "Unknown Customer"}</h3>
                                    <p className="text-xs text-muted-foreground">{(selectedConversation.customers as any)?.phone || "No phone"}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteId(selectedConversation.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20" ref={scrollRef}>
                            {loadingMessages ? (
                                <div className="text-center p-4">Loading messages...</div>
                            ) : messages?.map((m) => {
                                const isMe = m.sender_type === "human_agent" || m.sender_type === "bot"; // Treat bot as 'me' visually or differentiate?
                                // Better: human_agent = right (me), customer = left. bot = center or right? 
                                // Let's put bot on right (system) but maybe different color.
                                const isCustomer = m.sender_type === "customer";

                                return (
                                    <div key={m.id} className={cn("flex w-full", isCustomer ? "justify-start" : "justify-end")}>
                                        <div className={cn(
                                            "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm",
                                            isCustomer ? "bg-white border tr-round-bl-none" :
                                                m.sender_type === "bot" ? "bg-blue-50 border border-blue-100" : "bg-primary text-primary-foreground"
                                        )}>
                                            {m.message_type === "image" ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-xs opacity-70 mb-1"><ImageIcon className="h-3 w-3" /> Photo</div>
                                                    <p className="italic">Image content</p>
                                                </div>
                                            ) : (
                                                <p>{m.content}</p>
                                            )}
                                            <div className={cn("text-[10px] mt-1 text-right opacity-70", isCustomer ? "text-gray-500" : "text-white/80")}>
                                                {format(new Date(m.created_at), "HH:mm")}
                                                {!isCustomer && <span className="ml-1 inline-flex"><CheckCheck className="h-3 w-3" /></span>}
                                            </div>
                                            {m.sender_type === "bot" && <div className="text-[10px] text-blue-500 mt-0.5 text-right font-semibold">AI Bot</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t bg-card">
                            <div className="flex items-end gap-2">
                                <Button variant="ghost" size="icon" className="shrink-0"><ImageIcon className="h-5 w-5" /></Button>
                                <div className="flex-1 relative">
                                    <Input
                                        placeholder="Type a message..."
                                        className="pr-10"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                    />
                                </div>
                                <Button onClick={handleSend} disabled={!newMessage.trim() || sendMessage.isPending}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                                Reviewing this chat will pause the AI Bot for 30 minutes.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <User className="h-8 w-8 opacity-20" />
                        </div>
                        <h3 className="font-semibold text-lg">Select a conversation</h3>
                        <p>Choose a customer from the left to start chatting.</p>
                    </div>
                )}
            </Card>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this conversation and all its messages. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteId && deleteConversation.mutate(deleteId)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
