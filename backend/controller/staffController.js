const User = require("../model/User");
const { validateStaffFields } = require("../utils/validators");
const notify = require("../utils/realtimeNotify");

function formatStaff(user) {
  const json = user.toJSON();
  return {
    id: json.id,
    fname: json.fname,
    lname: json.lname,
    name: json.name,
    email: json.email,
    phone: json.phone,
    role: json.role,
    createdAt: new Date(json.createdAt).getTime(),
  };
}

exports.listStaff = async (_req, res) => {
  try {
    const staff = await User.find({ role: "staff" }).sort({ createdAt: -1 });
    return res.json({ ok: true, staff: staff.map(formatStaff) });
  } catch (err) {
    console.error("List staff error:", err);
    return res.status(500).json({ ok: false, msg: "Could not load staff" });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const validation = validateStaffFields({ ...req.body, requirePassword: true });
    if (!validation.ok) return res.status(400).json(validation);

    const { fname, lname, email, phone, password } = validation.data;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok: false, msg: "Email already in use" });
    }

    const staff = await User.create({
      fname,
      lname,
      email,
      phone,
      password,
      role: "staff",
      country: "",
      kyc: { status: "approved" },
    });

    const formatted = formatStaff(staff);
    notify.staffUpsert(formatted);

    return res.status(201).json({
      ok: true,
      msg: `Staff ${staff.name} created`,
      staff: formatted,
    });
  } catch (err) {
    console.error("Create staff error:", err);
    return res.status(500).json({ ok: false, msg: "Could not create staff" });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const staff = await User.findOne({ _id: req.params.id, role: "staff" });
    if (!staff) {
      return res.status(404).json({ ok: false, msg: "Staff member not found" });
    }

    const validation = validateStaffFields({ ...req.body, requirePassword: false });
    if (!validation.ok) return res.status(400).json(validation);

    const { fname, lname, email, phone, password } = validation.data;

    if (email !== staff.email) {
      const taken = await User.findOne({ email, _id: { $ne: staff._id } });
      if (taken) {
        return res.status(409).json({ ok: false, msg: "Email already in use" });
      }
    }

    staff.fname = fname;
    staff.lname = lname;
    staff.email = email;
    staff.phone = phone;
    if (password) staff.password = password;

    await staff.save();

    const formatted = formatStaff(staff);
    notify.staffUpsert(formatted);

    return res.json({
      ok: true,
      msg: "Staff updated",
      staff: formatted,
    });
  } catch (err) {
    console.error("Update staff error:", err);
    return res.status(500).json({ ok: false, msg: "Could not update staff" });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const staff = await User.findOneAndDelete({ _id: req.params.id, role: "staff" });
    if (!staff) {
      return res.status(404).json({ ok: false, msg: "Staff member not found" });
    }

    await User.updateMany({ assignedStaff: staff._id }, { $set: { assignedStaff: null } });

    notify.staffDeleted(staff._id.toString());

    return res.json({ ok: true, msg: "Staff removed" });
  } catch (err) {
    console.error("Delete staff error:", err);
    return res.status(500).json({ ok: false, msg: "Could not delete staff" });
  }
};
