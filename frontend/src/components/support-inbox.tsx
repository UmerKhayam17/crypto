import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquareText, RotateCcw, Send, User as UserIcon } from "lucide-react";
import { useStore } from "@/context/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { subscribeRealtime, type RealtimeMessage } from "@/services/realtime";
import {
  apiListMySupportThreads,
  apiListSupportThreads,
  apiListSupportThreadMessages,
  apiSendSupportMessage,
  apiSetSupportThreadStatus,
  type SupportMessage,
  type SupportThread,
} from "@/services/support";
import { cn } from "@/lib/utils";

type Props = {
  /** When true, hides page-level chrome for embedding inside admin panel */
  embedded?: boolean;
  className?: string;
  onOpenCountChange?: (count: number) => void;
};

function sortThreads(list: SupportThread[]) {
  return [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function upsertThread(list: SupportThread[], thread: SupportThread): SupportThread[] {
  const idx = list.findIndex((t) => t.id === thread.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...thread };
    return sortThreads(next);
  }
  return sortThreads([{ ...thread }, ...list]);
}

export function SupportInbox({ embedded = false, className, onOpenCountChange }: Props) {
  const { user, session } = useStore();
  const role = session?.role;

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = activeThreadId;
  }, [activeThreadId]);

  const isAgent = role === "admin" || role === "staff";

  const visibleThreads = useMemo(() => {
    if (!isAgent || filter === "all") return threads;
    return threads.filter((t) => t.status === filter);
  }, [threads, filter, isAgent]);

  const openCount = useMemo(() => threads.filter((t) => t.status === "open").length, [threads]);

  useEffect(() => {
    onOpenCountChange?.(openCount);
  }, [openCount, onOpenCountChange]);

  const loadThreads = async () => {
    if (!role) return;
    setLoadingThreads(true);
    try {
      const data = role === "user" ? await apiListMySupportThreads() : await apiListSupportThreads();
      const list = sortThreads(data.threads ?? []);
      setThreads(list);
      if (!activeRef.current && list.length > 0) {
        const preferred = list.find((t) => t.status === "open") || list[0];
        setActiveThreadId(preferred.id);
      }
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
      if (data.thread) {
        setThreads((xs) => upsertThread(xs, data.thread));
      }
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
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  useEffect(() => {
    if (!role) return;
    const unsub = subscribeRealtime((msg: RealtimeMessage) => {
      if (msg.type !== "support:message" && msg.type !== "support:thread") return;
      const payload = msg.payload as Record<string, unknown>;
      const thread = payload.thread as SupportThread | undefined;
      const message = payload.message as SupportMessage | undefined;
      if (!thread) return;

      setThreads((xs) =>
        upsertThread(xs, {
          ...thread,
          lastMessage: message || (xs.find((t) => t.id === thread.id)?.lastMessage),
        })
      );

      const activeId = activeRef.current;
      if (!activeId) {
        setActiveThreadId(thread.id);
      } else if (activeId === thread.id && message && msg.type === "support:message") {
        setMessages((xs) => (xs.some((m) => m.id === message.id) ? xs : [...xs, message]));
      }
    });
    return () => unsub();
  }, [role]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loadingMessages]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeUserName = useMemo(() => {
    if (!user) return "";
    return user.name || `${user.fname ?? ""} ${user.lname ?? ""}`.trim();
  }, [user]);

  const send = async () => {
    if (!role) return;
    const content = text.trim();
    if (!content) return;
    if (isAgent && !activeThreadId) {
      toast.error("Select a conversation to reply");
      return;
    }
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
      setThreads((xs) => upsertThread(xs, { ...sentThread, lastMessage: sentMessage }));
      if (sentThread.id !== activeRef.current) setActiveThreadId(sentThread.id);
      setMessages((xs) => (xs.some((m) => m.id === sentMessage.id) ? xs : [...xs, sentMessage]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: "open" | "closed") => {
    if (!activeThreadId || !isAgent) return;
    setStatusBusy(true);
    try {
      const data = await apiSetSupportThreadStatus(activeThreadId, status);
      if (data.thread) setThreads((xs) => upsertThread(xs, data.thread!));
      toast.success(data.msg || (status === "closed" ? "Ticket closed" : "Ticket reopened"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update ticket");
    } finally {
      setStatusBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className={cn("flex flex-col", embedded ? "h-[min(70vh,720px)]" : "", className)}>
      {!embedded && (
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              Customer Support
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAgent ? "Reply to customer messages in real time" : "Chat with support staff in real time"}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {isAgent ? `${openCount} open` : `Signed in as ${activeUserName}`}
          </div>
        </div>
      )}

      {embedded && isAgent && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-semibold tracking-tight">Customer support</div>
            <p className="text-xs text-muted-foreground">
              Live inbox for assigned and unassigned customers. Replying claims unassigned users.
            </p>
          </div>
          <div className="text-xs font-mono text-muted-foreground">{openCount} open</div>
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-[300px_1fr] gap-3 md:gap-4">
        <aside className="rounded-xl border border-border/60 bg-card/60 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{isAgent ? "Tickets" : "Your conversation"}</div>
            {isAgent && (
              <div className="flex rounded-md border border-border/60 overflow-hidden text-[10px]">
                {(["open", "closed", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-2 py-1 uppercase tracking-wide",
                      filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loadingThreads ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {isAgent
                ? filter === "open"
                  ? "No open tickets right now."
                  : "No tickets match this filter."
                : "No messages yet. Send your first message below."}
            </div>
          ) : (
            <div className="overflow-auto flex-1 max-h-[50vh] md:max-h-none">
              {visibleThreads.map((t) => {
                const active = t.id === activeThreadId;
                const subtitle = t.lastMessage?.content
                  ? t.lastMessage.content.length > 42
                    ? `${t.lastMessage.content.slice(0, 42)}…`
                    : t.lastMessage.content
                  : "No messages yet";
                const name = isAgent ? t.user?.name || t.user?.email || "User" : "Support";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveThreadId(t.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border/60 last:border-b-0 transition-colors",
                      active ? "bg-primary/10" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                      </div>
                      <div
                        className={cn(
                          "text-[10px] font-semibold whitespace-nowrap",
                          t.status === "open" ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {t.status === "open" ? "OPEN" : "CLOSED"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="rounded-xl border border-border/60 bg-card/60 flex flex-col overflow-hidden min-h-[420px]">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm font-semibold truncate">
              {!activeThreadId
                ? "Select a conversation"
                : !isAgent
                  ? "Support chat"
                  : activeThread?.user?.name || activeThread?.user?.email || "User"}
            </div>
            {isAgent && activeThread && (
              <div className="flex shrink-0 items-center gap-2">
                {activeThread.status === "open" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusBusy}
                    onClick={() => void setStatus("closed")}
                  >
                    {statusBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                    Close
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusBusy}
                    onClick={() => void setStatus("open")}
                  >
                    {statusBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                    Reopen
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {loadingMessages
                  ? "Loading messages…"
                  : isAgent
                    ? activeThreadId
                      ? "No messages in this ticket yet."
                      : "Pick a ticket from the list to reply."
                    : "No messages yet."}
              </div>
            )}
            {messages.map((m) => {
              const mine = role === "user" ? m.senderRole === "user" : m.senderRole !== "user";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm border",
                      mine
                        ? "bg-primary/10 border-primary/20 text-foreground"
                        : "bg-background/60 border-border/60"
                    )}
                  >
                    {!mine && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        {m.senderRole === "user" ? "Customer" : "Agent"}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
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
                onKeyDown={onKeyDown}
                placeholder={
                  isAgent
                    ? activeThreadId
                      ? "Type a reply… (Enter to send)"
                      : "Select a ticket to reply"
                    : "Type your message… (Enter to send)"
                }
                rows={3}
                disabled={sending || (isAgent && !activeThreadId)}
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void send()}
                  disabled={
                    sending ||
                    !text.trim() ||
                    (isAgent && !activeThreadId)
                  }
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {sending ? "Sending…" : "Send"}
                </Button>
                {isAgent && activeThread?.status === "closed" && (
                  <span className="text-[11px] text-muted-foreground">Sending will reopen this ticket.</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
