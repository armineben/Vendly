import { useEffect, useRef, useState, useMemo } from "react";
import {
  MessageSquare, Send, Loader2, ChevronLeft, CircleOff,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface ChatMessage {
  id: string;
  user_id: string;
  receiver_id: string | null;
  sender_name: string;
  message: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] ?? "?").toUpperCase();
}

function avatarColor(id: string): string {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500",
    "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-lime-500",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function conversationId(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

// ─── Component ──────────────────────────────────────────────

export function TeamChat({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"contacts" | "conversation">("contacts");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch contacts ──
  useEffect(() => {
    if (!open) return;
    setLoadingContacts(true);
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .order("display_name", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setContacts(data.filter((p) => p.id !== currentUserId));
        setLoadingContacts(false);
      });
  }, [open, currentUserId]);

  // ── Fetch messages for the selected conversation ──
  useEffect(() => {
    if (!open || !selectedUser) return;
    setLoadingMessages(true);
    const me = currentUserId;
    const them = selectedUser.id;
    supabase
      .from("chat_messages")
      .select("*")
      .or(`and(user_id.eq.${me},receiver_id.eq.${them}),and(user_id.eq.${them},receiver_id.eq.${me})`)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (data) setMessages(data);
        setLoadingMessages(false);
      });
  }, [open, selectedUser, currentUserId]);

  // ── Real-time per conversation ──
  useEffect(() => {
    if (!open || !selectedUser) return;
    const me = currentUserId;
    const them = selectedUser.id;
    const channelId = `chat-${conversationId(me, them)}`;

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `user_id=in.(${me},${them})`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          const isOurs =
            (msg.user_id === me && msg.receiver_id === them) ||
            (msg.user_id === them && msg.receiver_id === me);
          if (!isOurs) return;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, selectedUser, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Send message ──
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !selectedUser) return;
    setSending(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", currentUserId)
        .maybeSingle();
      const senderName = profile?.display_name ?? "Inconnu";
      const { error } = await supabase.from("chat_messages").insert({
        user_id: currentUserId,
        receiver_id: selectedUser.id,
        sender_name: senderName,
        message: trimmed,
      });
      if (error) throw error;
      setText("");
    } catch (err: any) {
      toast.error(err.message || "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Group messages by date ──
  const grouped = useMemo(() => {
    return messages.reduce<Record<string, ChatMessage[]>>((acc, m) => {
      const key = new Date(m.created_at).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});
  }, [messages]);

  const openConversation = (profile: Profile) => {
    setSelectedUser(profile);
    setView("conversation");
  };

  const backToContacts = () => {
    setSelectedUser(null);
    setMessages([]);
    setView("contacts");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) backToContacts();
      }}
    >
      <SheetTrigger asChild>
        <button
          aria-label="Messagerie équipe"
          className="rounded-full p-2 text-[#747878] hover:text-[#000000] hover:bg-[#f3f3f4] transition"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* ── Header ── */}
        <SheetHeader className="border-b border-slate-100 px-4 py-3 shrink-0">
          {view === "conversation" && selectedUser ? (
            <div className="flex items-center gap-3">
              <button
                onClick={backToContacts}
                className="rounded-full p-1 hover:bg-slate-100 transition"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${avatarColor(selectedUser.id)}`}
              >
                {initials(selectedUser.display_name ?? selectedUser.email ?? "?")}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold tracking-tight truncate text-slate-800">
                  {selectedUser.display_name ?? selectedUser.email ?? "Inconnu"}
                </SheetTitle>
                <p className="text-[10px] text-slate-400">En ligne</p>
              </div>
            </div>
          ) : (
            <SheetTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Messagerie
            </SheetTitle>
          )}
        </SheetHeader>

        {/* ── View: Contacts ── */}
        {view === "contacts" && (
          <>
            {loadingContacts ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <CircleOff className="h-6 w-6" />
                Aucun contact disponible
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="divide-y divide-slate-50">
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(c.id)}`}
                      >
                        {initials(c.display_name ?? c.email ?? "?")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {c.display_name ?? c.email ?? "Inconnu"}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {c.email ?? ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}

        {/* ── View: Conversation ── */}
        {view === "conversation" && selectedUser && (
          <>
            {loadingMessages ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Aucun message. Écrivez à {selectedUser.display_name ?? "cette personne"} !
              </div>
            ) : (
              <ScrollArea className="flex-1 px-4 py-4">
                {Object.entries(grouped).map(([dateKey, msgs]) => (
                  <div key={dateKey}>
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {formatDateLabel(msgs[0].created_at)}
                      </span>
                    </div>
                    {msgs.map((msg) => {
                      const isMine = msg.user_id === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`mb-2.5 flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}
                        >
                          {!isMine && (
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${avatarColor(msg.user_id)}`}
                            >
                              {initials(msg.sender_name)}
                            </div>
                          )}
                          <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                            <div
                              className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                                isMine
                                  ? "bg-blue-600 text-white rounded-2xl rounded-br-none"
                                  : "bg-slate-100 text-slate-800 rounded-2xl rounded-bl-none"
                              }`}
                            >
                              {msg.message}
                            </div>
                            <span
                              className={`text-[10px] mt-0.5 px-1 ${
                                isMine ? "text-slate-400 text-right" : "text-slate-400 text-left"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </ScrollArea>
            )}

            {/* ── Input ── */}
            <div className="border-t border-slate-100 p-3 flex gap-2 shrink-0 bg-white">
              <Input
                placeholder="Votre message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-10 text-sm rounded-xl border-slate-200 focus-visible:ring-blue-500 bg-slate-50"
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !text.trim()}
                className="h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 shrink-0 rounded-xl"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
