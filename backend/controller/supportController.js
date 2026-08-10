const SupportThread = require("../model/SupportThread");
const SupportMessage = require("../model/SupportMessage");
const User = require("../model/User");
const notify = require("../utils/realtimeNotify");
const formatSupportThread = require("../utils/formatSupportThread");
const formatSupportMessage = require("../utils/formatSupportMessage");

async function getMyOpenThread(userId) {
  const id = userId?.toString?.();
  if (!id) return null;
  return SupportThread.findOne({ user: id, status: "open" }).sort({ updatedAt: -1 });
}

async function getOrCreateThread(userId) {
  const existing = await getMyOpenThread(userId);
  if (existing) return existing;
  return SupportThread.create({ user: userId, status: "open" });
}

async function canAccessThread(actor, threadId) {
  const thread = await SupportThread.findById(threadId).populate(
    "user",
    "fname lname name email assignedStaff"
  );
  if (!thread) return { ok: false, msg: "Thread not found", thread: null };

  if (actor.role === "admin") return { ok: true, thread };

  if (actor.role === "staff") {
    const assignedStaffId = thread.user?.assignedStaff?.toString?.() || null;
    // Staff can access their assigned users and unassigned users (claim on reply)
    if (assignedStaffId && assignedStaffId !== actor._id.toString()) {
      return { ok: false, msg: "Not authorized for this thread", thread: null };
    }
    return { ok: true, thread };
  }

  if (actor.role === "user") {
    const ownerId = thread.user?._id?.toString?.() || thread.user?.toString?.();
    if (!ownerId || ownerId !== actor._id.toString()) {
      return { ok: false, msg: "Not authorized for this thread", thread: null };
    }
    return { ok: true, thread };
  }

  return { ok: false, msg: "Not authorized", thread: null };
}

async function threadWithLastMessage(thread) {
  const lastMessage = await SupportMessage.findOne({ thread: thread._id }).sort({ createdAt: -1 });
  const formattedThread = formatSupportThread({
    ...thread.toJSON(),
    user: thread.user,
  });
  const formattedLast = lastMessage ? formatSupportMessage(lastMessage) : undefined;
  return { thread: formattedThread, lastMessage: formattedLast };
}

async function maybeClaimUser(actor, thread) {
  if (actor.role !== "staff") return;
  const userId = thread.user?._id || thread.user;
  if (!userId) return;
  const owner = await User.findById(userId);
  if (!owner || owner.role !== "user") return;
  if (owner.assignedStaff) return;
  owner.assignedStaff = actor._id;
  await owner.save();
  thread.user = owner;
}

exports.listMyThreads = async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).json({ ok: false, msg: "User access required" });
    }

    const openThreads = await SupportThread.find({ user: req.user._id, status: "open" })
      .sort({ updatedAt: -1 })
      .limit(20);
    const closedThreads = await SupportThread.find({ user: req.user._id, status: "closed" })
      .sort({ updatedAt: -1 })
      .limit(20);

    const threads = [...openThreads, ...closedThreads].slice(0, 20);
    const enriched = [];
    for (const t of threads) {
      enriched.push(await threadWithLastMessage(t));
    }

    return res.json({
      ok: true,
      threads: enriched.map((x) => ({ ...x.thread, lastMessage: x.lastMessage })),
    });
  } catch (err) {
    console.error("listMyThreads error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load support threads" });
  }
};

exports.listThreads = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ ok: false, msg: "Admin/staff access required" });
    }

    let query = {};
    if (req.user.role === "staff") {
      const assignedUsers = await User.find({
        role: "user",
        $or: [{ assignedStaff: req.user._id }, { assignedStaff: null }, { assignedStaff: { $exists: false } }],
      }).select("_id");
      const ids = assignedUsers.map((u) => u._id);
      if (ids.length === 0) return res.json({ ok: true, threads: [], openCount: 0 });
      query = { user: { $in: ids } };
    }

    const statusFilter = req.query.status;
    if (statusFilter === "open" || statusFilter === "closed") {
      query.status = statusFilter;
    }

    const threads = await SupportThread.find(query)
      .populate("user", "fname lname name email assignedStaff")
      .sort({ updatedAt: -1 })
      .limit(100);

    const enriched = [];
    for (const t of threads) {
      const lastMessage = await SupportMessage.findOne({ thread: t._id }).sort({ createdAt: -1 });
      enriched.push({
        ...formatSupportThread(t),
        lastMessage: lastMessage ? formatSupportMessage(lastMessage) : undefined,
      });
    }

    const openCount = enriched.filter((t) => t.status === "open").length;

    return res.json({ ok: true, threads: enriched, openCount });
  } catch (err) {
    console.error("listThreads error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load support threads" });
  }
};

exports.listThreadMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const access = await canAccessThread(req.user, id);
    if (!access.ok) return res.status(403).json({ ok: false, msg: access.msg });

    const messages = await SupportMessage.find({ thread: access.thread._id }).sort({ createdAt: 1 });
    return res.json({
      ok: true,
      thread: formatSupportThread(access.thread),
      messages: messages.map(formatSupportMessage),
    });
  } catch (err) {
    console.error("listThreadMessages error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load messages" });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const actor = req.user;
    const { threadId, content } = req.body || {};

    if (!content || typeof content !== "string") {
      return res.status(400).json({ ok: false, msg: "Message content is required" });
    }

    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > 2000) {
      return res.status(400).json({ ok: false, msg: "Message must be 1–2000 characters" });
    }

    let thread = null;

    if (actor.role === "user") {
      thread = await getOrCreateThread(actor._id);
    } else {
      if (!threadId || typeof threadId !== "string") {
        return res.status(400).json({ ok: false, msg: "threadId is required" });
      }
      const access = await canAccessThread(actor, threadId);
      if (!access.ok) return res.status(403).json({ ok: false, msg: access.msg });
      thread = access.thread;
      await maybeClaimUser(actor, thread);
    }

    if (!thread) return res.status(404).json({ ok: false, msg: "Thread not found" });

    // Re-open closed threads when anyone sends a new message
    if (thread.status !== "open") {
      thread.status = "open";
    }
    thread.updatedAt = new Date();
    await thread.save();

    const senderRole = actor.role === "user" ? "user" : actor.role === "admin" ? "admin" : "staff";
    const message = await SupportMessage.create({
      thread: thread._id,
      senderId: actor._id,
      senderRole,
      content: trimmed,
    });

    const formattedThreadDoc = await SupportThread.findById(thread._id).populate(
      "user",
      "fname lname name email assignedStaff"
    );
    const formattedThread = formatSupportThread(formattedThreadDoc);
    const formattedMessage = formatSupportMessage(message);
    const userId = (formattedThreadDoc.user?._id || thread.user).toString();

    notify.supportMessageUpsert(formattedThread, formattedMessage, {
      userId,
      threadId: formattedThread.id,
    });

    return res.json({
      ok: true,
      msg: "Message sent",
      thread: formattedThread,
      message: formattedMessage,
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ ok: false, msg: "Could not send message" });
  }
};

exports.setThreadStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ ok: false, msg: "Admin/staff access required" });
    }

    const status = req.body?.status;
    if (!["open", "closed"].includes(status)) {
      return res.status(400).json({ ok: false, msg: "Status must be open or closed" });
    }

    const access = await canAccessThread(req.user, req.params.id);
    if (!access.ok) return res.status(403).json({ ok: false, msg: access.msg });

    const thread = access.thread;
    thread.status = status;
    await thread.save();

    if (req.user.role === "staff") {
      await maybeClaimUser(req.user, thread);
    }

    const populated = await SupportThread.findById(thread._id).populate(
      "user",
      "fname lname name email assignedStaff"
    );
    const lastMessage = await SupportMessage.findOne({ thread: thread._id }).sort({ createdAt: -1 });
    const formatted = {
      ...formatSupportThread(populated),
      lastMessage: lastMessage ? formatSupportMessage(lastMessage) : undefined,
    };

    const userId = (populated.user?._id || thread.user).toString();
    notify.supportThreadUpdated(formatted, { userId, threadId: formatted.id });

    return res.json({
      ok: true,
      msg: status === "closed" ? "Ticket closed" : "Ticket reopened",
      thread: formatted,
    });
  } catch (err) {
    console.error("setThreadStatus error:", err);
    return res.status(500).json({ ok: false, msg: "Could not update ticket" });
  }
};
