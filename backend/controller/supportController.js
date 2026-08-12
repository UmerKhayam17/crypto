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
    if (!assignedStaffId || assignedStaffId !== actor._id.toString()) {
      return { ok: false, msg: "Not authorized — only assigned customers", thread: null };
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

function readerLastReadAt(thread, readerId) {
  const id = readerId?.toString?.();
  if (!id) return new Date(0);
  let max = 0;
  for (const entry of thread.reads || []) {
    if (entry.reader?.toString?.() !== id) continue;
    const t = entry?.at ? new Date(entry.at).getTime() : 0;
    if (t > max) max = t;
  }
  return max > 0 ? new Date(max) : new Date(0);
}

async function markThreadReadDoc(thread, readerId) {
  const threadId = thread?._id;
  const rid = readerId;
  if (!threadId || !rid) return thread;
  const now = new Date();

  // Prefer atomic updates to avoid VersionError under concurrent loads
  let updated = await SupportThread.findOneAndUpdate(
    { _id: threadId, "reads.reader": rid },
    { $set: { "reads.$.at": now } },
    { new: true }
  );
  if (!updated) {
    updated = await SupportThread.findByIdAndUpdate(
      threadId,
      { $push: { reads: { reader: rid, at: now } } },
      { new: true }
    );
  }
  return updated || thread;
}

async function threadsForActor(actor) {
  if (actor.role === "user") {
    return SupportThread.find({ user: actor._id }).select("_id reads user").limit(50);
  }
  if (actor.role === "staff") {
    const assignedUsers = await User.find({
      role: "user",
      assignedStaff: actor._id,
    }).select("_id");
    const ids = assignedUsers.map((u) => u._id);
    if (ids.length === 0) return [];
    return SupportThread.find({ user: { $in: ids } }).select("_id reads user").limit(200);
  }
  if (actor.role === "admin") {
    return SupportThread.find({}).select("_id reads user").limit(200);
  }
  return [];
}

function unreadMessageFilter(actor, thread, since) {
  const filter = {
    thread: thread._id,
    createdAt: { $gt: since },
    senderId: { $ne: actor._id },
  };
  if (actor.role === "user") {
    filter.senderRole = { $in: ["staff", "admin"] };
  } else {
    filter.senderRole = "user";
  }
  return filter;
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

    const userQuery = { role: "user" };
    if (req.user.role === "staff") {
      userQuery.assignedStaff = req.user._id;
    }

    const customers = await User.find(userQuery)
      .select("fname lname name email assignedStaff createdAt")
      .sort({ createdAt: -1 })
      .limit(300);

    if (customers.length === 0) {
      return res.json({ ok: true, threads: [], openCount: 0 });
    }

    const enriched = [];
    for (const customer of customers) {
      let thread = await SupportThread.findOne({ user: customer._id, status: "open" }).sort({
        updatedAt: -1,
      });
      if (!thread) {
        thread = await SupportThread.findOne({ user: customer._id }).sort({ updatedAt: -1 });
      }
      if (!thread) {
        thread = await SupportThread.create({ user: customer._id, status: "open" });
      }
      // Keep every customer available in support (no closed inbox)
      if (thread.status !== "open") {
        thread.status = "open";
        await thread.save();
      }

      thread.user = customer;
      const lastMessage = await SupportMessage.findOne({ thread: thread._id }).sort({ createdAt: -1 });
      enriched.push({
        ...formatSupportThread({
          ...(thread.toJSON ? thread.toJSON() : thread),
          user: customer,
        }),
        lastMessage: lastMessage ? formatSupportMessage(lastMessage) : undefined,
      });
    }

    enriched.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return res.json({ ok: true, threads: enriched, openCount: enriched.length });
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

    try {
      await markThreadReadDoc(access.thread, req.user._id);
    } catch (markErr) {
      console.warn("markThreadReadDoc soft-fail:", markErr?.message || markErr);
    }

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

exports.getUnread = async (req, res) => {
  try {
    const actor = req.user;
    const threads = await threadsForActor(actor);
    let count = 0;
    let preview = null;
    let latestAt = 0;
    let threadId = null;

    for (const thread of threads) {
      const since = readerLastReadAt(thread, actor._id);
      const filter = unreadMessageFilter(actor, thread, since);
      const n = await SupportMessage.countDocuments(filter);
      if (n <= 0) continue;
      count += n;
      const last = await SupportMessage.findOne(filter).sort({ createdAt: -1 });
      if (last) {
        const t = last.createdAt?.getTime?.() || 0;
        if (t >= latestAt) {
          latestAt = t;
          preview = formatSupportMessage(last);
          threadId = thread._id.toString();
        }
      }
    }

    return res.json({
      ok: true,
      count,
      preview,
      threadId: threadId || undefined,
      at: latestAt || undefined,
    });
  } catch (err) {
    console.error("getUnread error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load unread support" });
  }
};

exports.markThreadRead = async (req, res) => {
  try {
    const access = await canAccessThread(req.user, req.params.id);
    if (!access.ok) return res.status(403).json({ ok: false, msg: access.msg });

    await markThreadReadDoc(access.thread, req.user._id);
    return res.json({ ok: true, msg: "Marked as read" });
  } catch (err) {
    console.error("markThreadRead error:", err);
    return res.status(500).json({ ok: false, msg: "Could not mark as read" });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const path = require("path");
    const fs = require("fs");
    const sharp = require("sharp");
    const { randomUploadName } = require("../utils/uploadNames");

    const actor = req.user;
    const body = req.body || {};
    const threadId = body.threadId;
    const rawContent = typeof body.content === "string" ? body.content : "";
    const trimmed = rawContent.trim();
    const imageFile = req.file;

    if (!trimmed && !imageFile) {
      return res.status(400).json({ ok: false, msg: "Message text or a screenshot is required" });
    }
    if (trimmed.length > 2000) {
      return res.status(400).json({ ok: false, msg: "Message must be at most 2000 characters" });
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
    }

    if (!thread) return res.status(404).json({ ok: false, msg: "Thread not found" });

    let imageUrl = "";
    if (imageFile) {
      const MAX_BYTES = 10 * 1024 * 1024;
      if (!imageFile.buffer?.length) {
        return res.status(400).json({ ok: false, msg: "Screenshot upload was empty" });
      }
      if (imageFile.buffer.length > MAX_BYTES) {
        return res.status(400).json({ ok: false, msg: "Screenshot too large (max 10 MB)" });
      }
      if (!String(imageFile.mimetype || "").startsWith("image/")) {
        return res.status(400).json({ ok: false, msg: "Screenshot must be an image" });
      }

      let webp;
      try {
        webp = await sharp(imageFile.buffer, { failOn: "none" })
          .rotate()
          .webp({ quality: 80, effort: 4 })
          .toBuffer();
      } catch {
        return res.status(400).json({ ok: false, msg: "Could not process screenshot — use JPG or PNG" });
      }

      const uploadDir = path.join(__dirname, "..", "uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = randomUploadName("support", "shot.webp", "image/webp", ".webp");
      fs.writeFileSync(path.join(uploadDir, filename), webp);
      imageUrl = `${req.protocol}://${req.get("host")}/api/media/${filename}`;
    }

    if (thread.status !== "open") {
      thread.status = "open";
    }
    thread.updatedAt = new Date();
    await thread.save();

    const senderRole = actor.role === "user" ? "user" : actor.role === "admin" ? "admin" : "staff";
    const content = trimmed || (imageUrl ? "Screenshot attached" : "");
    const message = await SupportMessage.create({
      thread: thread._id,
      senderId: actor._id,
      senderRole,
      content,
      image: imageUrl,
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

exports.editMessage = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ ok: false, msg: "Admin access required" });
    }

    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      return res.status(400).json({ ok: false, msg: "Message text is required" });
    }
    if (content.length > 2000) {
      return res.status(400).json({ ok: false, msg: "Message must be at most 2000 characters" });
    }

    const message = await SupportMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ ok: false, msg: "Message not found" });

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const populated = await SupportThread.findById(message.thread).populate(
      "user",
      "fname lname name email assignedStaff"
    );
    if (!populated) return res.status(404).json({ ok: false, msg: "Thread not found" });

    const formattedThread = formatSupportThread(populated);
    const formattedMessage = formatSupportMessage(message);
    const userId = (populated.user?._id || populated.user).toString();

    notify.supportMessageUpsert(formattedThread, formattedMessage, {
      userId,
      threadId: formattedThread.id,
      edited: true,
    });

    return res.json({
      ok: true,
      msg: "Message updated",
      thread: formattedThread,
      message: formattedMessage,
    });
  } catch (err) {
    console.error("editMessage error:", err);
    return res.status(500).json({ ok: false, msg: "Could not edit message" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ ok: false, msg: "Admin access required" });
    }

    const message = await SupportMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ ok: false, msg: "Message not found" });

    const threadId = message.thread;
    const messageId = message._id.toString();
    await message.deleteOne();

    const populated = await SupportThread.findById(threadId).populate(
      "user",
      "fname lname name email assignedStaff"
    );
    if (!populated) {
      return res.json({ ok: true, msg: "Message deleted" });
    }

    const lastMessage = await SupportMessage.findOne({ thread: threadId }).sort({ createdAt: -1 });
    const formattedThread = {
      ...formatSupportThread(populated),
      lastMessage: lastMessage ? formatSupportMessage(lastMessage) : undefined,
    };
    const userId = (populated.user?._id || populated.user).toString();

    notify.supportMessageDeleted(formattedThread, messageId, {
      userId,
      threadId: formattedThread.id,
    });

    return res.json({
      ok: true,
      msg: "Message deleted",
      thread: formattedThread,
      messageId,
    });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ ok: false, msg: "Could not delete message" });
  }
};
