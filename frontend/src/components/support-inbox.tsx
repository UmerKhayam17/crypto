import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ImagePlus,
  Loader2,
  MessageSquareText,
  Pencil,
  Send,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useStore } from "@/context/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { subscribeRealtime, type RealtimeMessage } from "@/services/realtime";
import {
  apiListMySupportThreads,
  apiListSupportThreads,
  apiListSupportThreadMessages,
  apiSendSupportMessage,
  apiMarkSupportThreadRead,
  apiEditSupportMessage,
  apiDeleteSupportMessage,
  type SupportMessage,
  type SupportThread,
} from "@/services/support";
import { mediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

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
  const { user, session, setSupportInboxFocused, refreshSupportUnread } = useStore();
  const role = session?.role;
  const isAdmin = role === "admin";

  useEffect(() => {
    setSupportInboxFocused(true);
    return () => setSupportInboxFocused(false);
  }, [setSupportInboxFocused]);

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = activeThreadId;
  }, [activeThreadId]);

  const isAgent = role === "admin" || role === "staff";

  const customerCount = useMemo(() => threads.length, [threads]);

  useEffect(() => {
    onOpenCountChange?.(customerCount);
  }, [customerCount, onOpenCountChange]);

  const loadThreads = async () => {
    if (!role) return;
    setLoadingThreads(true);
    try {
      const data = role === "user" ? await apiListMySupportThreads() : await apiListSupportThreads();
      const list = sortThreads(data.threads ?? []);
      setThreads(list);
      if (!activeRef.current && list.length > 0) {
        const preferred = list.find((t) => t.lastMessage) || list[0];
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
      await refreshSupportUnread();
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
    setEditingId(null);
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

      if (payload.deleted || message?.deleted) {
        const mid = message?.id;
        if (mid) {
          setMessages((xs) => xs.filter((m) => m.id !== mid));
        }
        setThreads((xs) => upsertThread(xs, thread));
        return;
      }

      setThreads((xs) =>
        upsertThread(xs, {
          ...thread,
          lastMessage: message || xs.find((t) => t.id === thread.id)?.lastMessage,
        })
      );

      const activeId = activeRef.current;
      if (!activeId) {
        setActiveThreadId(thread.id);
      } else if (activeId === thread.id && message && msg.type === "support:message") {
        setMessages((xs) => {
          const idx = xs.findIndex((m) => m.id === message.id);
          if (idx >= 0) {
            const next = [...xs];
            next[idx] = { ...next[idx], ...message };
            return next;
          }
          return [...xs, message];
        });
        void apiMarkSupportThreadRead(thread.id)
          .then(() => refreshSupportUnread())
          .catch(() => {});
      } else if (msg.type === "support:message") {
        void refreshSupportUnread();
      }
    });
    return () => unsub();
  }, [role, refreshSupportUnread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loadingMessages]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const activeUserName = useMemo(() => {
    if (!user) return "";
    return user.name || `${user.fname ?? ""} ${user.lname ?? ""}`.trim();
  }, [user]);

  const clearAttachment = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
  };

  const onPickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Screenshot must be an image");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error("Screenshot too large (max 10 MB)");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const send = async () => {
    if (!role) return;
    const content = text.trim();
    if (!content && !imageFile) return;
    if (isAgent && !activeThreadId) {
      toast.error("Select a conversation to reply");
      return;
    }
    setSending(true);
    try {
      const res =
        role === "user"
          ? await apiSendSupportMessage({ content, image: imageFile })
          : await apiSendSupportMessage({
              threadId: activeThreadId ?? undefined,
              content,
              image: imageFile,
            });

      const sentThread = res.thread;
      const sentMessage = res.message;
      if (!sentThread || !sentMessage) {
        toast.error("Message not sent");
        return;
      }

      setText("");
      clearAttachment();
      setThreads((xs) => upsertThread(xs, { ...sentThread, lastMessage: sentMessage }));
      if (sentThread.id !== activeRef.current) setActiveThreadId(sentThread.id);
      setMessages((xs) => (xs.some((m) => m.id === sentMessage.id) ? xs : [...xs, sentMessage]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId || !isAdmin) return;
    const content = editText.trim();
    if (!content) {
      toast.error("Message text is required");
      return;
    }
    setEditBusy(true);
    try {
      const res = await apiEditSupportMessage(editingId, content);
      if (res.message) {
        setMessages((xs) => xs.map((m) => (m.id === res.message!.id ? { ...m, ...res.message! } : m)));
      }
      if (res.thread) setThreads((xs) => upsertThread(xs, res.thread!));
      setEditingId(null);
      toast.success("Message updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not edit message");
    } finally {
      setEditBusy(false);
    }
  };

  const removeMessage = async (messageId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    setDeleteBusyId(messageId);
    try {
      const res = await apiDeleteSupportMessage(messageId);
      setMessages((xs) => xs.filter((m) => m.id !== messageId));
      if (res.thread) setThreads((xs) => upsertThread(xs, res.thread!));
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete message");
    } finally {
      setDeleteBusyId(null);
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
            {isAgent ? `${customerCount} customers` : `Signed in as ${activeUserName}`}
          </div>
        </div>
      )}

      {embedded && isAgent && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-semibold tracking-tight">Customer support</div>
            <p className="text-xs text-muted-foreground">
              {role === "staff"
                ? "All assigned customers appear here."
                : "All customers appear here. Only admin can edit or delete messages."}
            </p>
          </div>
          <div className="text-xs font-mono text-muted-foreground">{customerCount} customers</div>
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-[300px_1fr] gap-3 md:gap-4">
        <aside className="rounded-xl border border-border/60 bg-card/60 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border/60">
            <div className="text-sm font-semibold">{isAgent ? "Customers" : "Your conversation"}</div>
          </div>
          {loadingThreads ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {isAgent
                ? role === "staff"
                  ? "No assigned customers yet."
                  : "No customers yet."
                : "No messages yet. Send your first message below."}
            </div>
          ) : (
            <div className="overflow-auto flex-1 max-h-[50vh] md:max-h-none">
              {threads.map((t) => {
                const active = t.id === activeThreadId;
                const subtitle = t.lastMessage?.image
                  ? t.lastMessage.content && t.lastMessage.content !== "Screenshot attached"
                    ? `[Image] ${t.lastMessage.content.length > 34 ? t.lastMessage.content.slice(0, 34) + "…" : t.lastMessage.content}`
                    : "[Screenshot attached]"
                  : t.lastMessage?.content
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
                    <div className="min-w-0">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="rounded-xl border border-border/60 bg-card/60 flex flex-col overflow-hidden min-h-[420px]">
          <div className="px-4 py-3 border-b border-border/60">
            <div className="min-w-0 text-sm font-semibold truncate">
              {!activeThreadId
                ? "Select a conversation"
                : !isAgent
                  ? "Support chat"
                  : activeThread?.user?.name || activeThread?.user?.email || "User"}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {loadingMessages
                  ? "Loading messages…"
                  : isAgent
                    ? activeThreadId
                      ? "No messages yet. Start the conversation below."
                      : "Pick a customer from the list to chat."
                    : "No messages yet."}
              </div>
            )}
            {messages.map((m) => {
              const mine = role === "user" ? m.senderRole === "user" : m.senderRole !== "user";
              const isEditing = editingId === m.id;
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

                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          disabled={editBusy}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={editBusy || !editText.trim()} onClick={() => void saveEdit()}>
                            {editBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={editBusy}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!!m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
                        {!!m.image && (
                          <a
                            href={mediaUrl(m.image)}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "block overflow-hidden rounded-md border border-border/60",
                              m.content ? "mt-2" : ""
                            )}
                          >
                            <img
                              src={mediaUrl(m.image)}
                              alt="Support screenshot"
                              className="max-h-56 w-full object-contain bg-background/80"
                            />
                          </a>
                        )}
                      </>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span>
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                        {m.editedAt ? " · edited" : ""}
                      </span>
                      {isAdmin && !isEditing && (
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditText(m.content || "");
                            }}
                            title="Edit message"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                            disabled={deleteBusyId === m.id}
                            onClick={() => void removeMessage(m.id)}
                            title="Delete message"
                          >
                            {deleteBusyId === m.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Delete
                          </button>
                        </span>
                      )}
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
                      : "Select a customer to reply"
                    : "Describe your issue… You can also attach a screenshot"
                }
                rows={3}
                disabled={sending || (isAgent && !activeThreadId)}
              />

              {imagePreview && (
                <div className="relative inline-flex max-w-xs items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
                  <img src={imagePreview} alt="Screenshot preview" className="h-20 w-auto rounded object-cover" />
                  <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                    <div className="font-medium text-foreground truncate">{imageFile?.name || "Screenshot"}</div>
                    <div>{imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}</div>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Remove screenshot"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sending || (isAgent && !activeThreadId)}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" />
                  Attach Screenshot
                </Button>
                <Button
                  onClick={() => void send()}
                  disabled={
                    sending ||
                    (!text.trim() && !imageFile) ||
                    (isAgent && !activeThreadId)
                  }
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {sending ? "Sending…" : "Send"}
                </Button>
                {!isAgent && (
                  <span className="text-[11px] text-muted-foreground">JPG/PNG · max 10 MB</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
