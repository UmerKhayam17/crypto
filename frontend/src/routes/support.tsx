import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, MessageSquareText, User as UserIcon } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RequireAuth } from "@/components/auth/require-auth";
import { useStore } from "@/context/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { subscribeRealtime, type RealtimeMessage } from "@/services/realtime";
import { apiListMySupportThreads, apiListSupportThreads, apiListSupportThreadMessages, apiSendSupportMessage, type SupportMessage, type SupportThread } from "@/services/support";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Customer Support — NovaTrade" },
      { name: "description", content: "Chat with support staff in real time." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <RequireAuth roles={["user", "admin", "staff"]}>
      <SupportContent />
    </RequireAuth>
  );
}

function SupportContent() {
  const { user, session } = useStore();
  const role = session?.role;

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(null);
  useEffect(() => { activeRef.current = activeThreadId; }, [activeThreadId]);

  const isAgent = role === "admin" || role === "staff";

  const loadThreads = async () => {
    if (!role) return;
    setLoadingThreads(true);
    try {
      const data =
        role === "user" ? await apiListMySupportThreads() : await apiListSupportThreads();
      const list = data.threads ?? [];
      setThreads(list);
      if (!activeRef.current && list.length > 0) setActiveThreadId(list[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load support");
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    setLoadingMessages(true);
    try {
      const data = await apiListSupportThreadMessages(threadId);
      setMessages(data.messages ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!role) return;
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!activeThreadId) return;
    void loadMessages(activeThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Real-time updates (new message)
  useEffect(() => {
    if (!role) return;
    const unsub = subscribeRealtime((msg: RealtimeMessage) => {
      if (msg.type !== "support:message") return;
      const payload = msg.payload as any;
      const thread = payload.thread as SupportThread | undefined;
      const message = payload.message as SupportMessage | undefined;
      if (!thread || !message) return;

      setThreads((xs) => {
        const idx = xs.findIndex((t) => t.id === thread.id);
        if (idx >= 0) {
          const next = [...xs];
          next[idx] = { ...next[idx], ...thread, lastMessage: message };
          next.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          return next;
        }
        return [{ ...thread, lastMessage: message }, ...xs];
      });

      const activeId = activeRef.current;
      if (!activeId) {
        setActiveThreadId(thread.id);
      } else if (activeId === thread.id) {
        setMessages((xs) => (xs.some((m) => m.id === message.id) ? xs : [...xs, message]));
      }
    });

    return () => unsub();
  }, [role]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loadingMessages]);

  const activeUserName = useMemo(() => {
    if (!user) return "";
    return user.name || `${user.fname ?? ""} ${user.lname ?? ""}`.trim();
  }, [user]);

  const send = async () => {
    if (!role) return;
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const res =
        role === "user"
          ? await apiSendSupportMessage({ content })
          : await apiSendSupportMessage({ threadId: activeThreadId ?? undefined, content });

      const sentThread = res.thread;
      const sentMessage = res.message;
      if (!sentThread || !sentMessage) {
        toast.error("Message not sent");
        return;
      }

      setText("");
      setThreads((xs) => {
        const idx = xs.findIndex((t) => t.id === sentThread.id);
        if (idx >= 0) {
          const next = [...xs];
          next[idx] = { ...next[idx], ...sentThread, lastMessage: sentMessage };
          next.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          return next;
        }
        return [{ ...sentThread, lastMessage: sentMessage }, ...xs];
      });

      if (sentThread.id !== activeRef.current) setActiveThreadId(sentThread.id);
      setMessages((xs) => (xs.some((m) => m.id === sentMessage.id) ? xs : [...xs, sentMessage]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-0">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              Customer Support
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAgent ? "Reply to customer messages" : "Chat with support staff in real time"}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {isAgent ? "Agent mode" : `Signed in as ${activeUserName}`}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 md:gap-4">
          <aside className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 text-sm font-semibold">
              {isAgent ? "Support requests" : "Your conversation"}
            </div>
            {loadingThreads ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : threads.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No messages yet. Send your first message below.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                {threads.map((t) => {
                  const active = t.id === activeThreadId;
                  const subtitle =
                    t.lastMessage?.content
                      ? t.lastMessage.content.length > 40
                        ? t.lastMessage.content.slice(0, 40) + "…"
                        : t.lastMessage.content
                      : "No messages yet";
                  const name = isAgent ? t.user?.name || t.user?.email || "User" : "Support";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveThreadId(t.id)}
                      className={`w-full text-left px-4 py-3 border-b border-border/60 last:border-b-0 transition-colors ${
                        active ? "bg-primary/10" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{name}</div>
                          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                        </div>
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {t.status === "open" ? "OPEN" : "CLOSED"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="rounded-xl border border-border/60 bg-card/60 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 text-sm font-semibold">
              {(() => {
                if (!activeThreadId) return "Select a conversation";
                if (!isAgent) return "Support chat";
                const t = threads.find((x) => x.id === activeThreadId);
                return t?.user?.name || t?.user?.email || "User";
              })()}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  {loadingMessages ? "Loading messages…" : "No messages yet."}
                </div>
              )}
              {messages.map((m) => {
                const mine = role === "user" ? m.senderRole === "user" : m.senderRole !== "user";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm border ${
                        mine
                          ? "bg-primary/10 border-primary/20 text-foreground"
                          : "bg-background/60 border-border/60"
                      }`}
                    >
                      {!mine && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                          <UserIcon className="h-3.5 w-3.5" />
                          {m.senderRole === "user" ? "Customer" : "Agent"}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-border/60">
              <div className="flex flex-col gap-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={isAgent ? "Type a reply…" : "Type your message…"}
                  rows={3}
                  disabled={sending}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="hidden"
                    value={activeThreadId ?? ""}
                    readOnly
                  />
                  <Button
                    onClick={() => void send()}
                    disabled={sending || (!isAgent && !text.trim()) || (isAgent && !activeThreadId)}
                    className="bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {sending ? "Sending…" : "Send"}
                  </Button>
                  {isAgent && !activeThreadId && (
                    <div className="text-xs text-muted-foreground">Pick a thread to reply.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

