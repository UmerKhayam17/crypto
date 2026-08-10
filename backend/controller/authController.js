const User = require("../model/User");
const generateToken = require("../utils/generateToken");
const formatUser = require("../utils/formatUser");
const notify = require("../utils/realtimeNotify");

const nameRe = /^[A-Za-z][A-Za-z\s'-]{1,49}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneRe = /^[+\d][\d\s().-]{6,24}$/;

exports.register = async (req, res) => {
  try {
    const { fname, lname, email, phone, country, password } = req.body;

    const trimmedFname = fname?.trim();
    const trimmedLname = lname?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPhone = phone?.trim();
    const trimmedCountry = country?.trim();

    if (!nameRe.test(trimmedFname || "")) {
      return res.status(400).json({ ok: false, msg: "First name: letters only, 2–50 chars" });
    }
    if (!nameRe.test(trimmedLname || "")) {
      return res.status(400).json({ ok: false, msg: "Last name: letters only, 2–50 chars" });
    }
    if (!emailRe.test(trimmedEmail || "")) {
      return res.status(400).json({ ok: false, msg: "Enter a valid email address" });
    }
    if (!trimmedCountry) {
      return res.status(400).json({ ok: false, msg: "Select your country" });
    }
    if (!phoneRe.test(trimmedPhone || "")) {
      return res.status(400).json({ ok: false, msg: "Enter a valid contact number" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, msg: "Password must be at least 6 characters" });
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ ok: false, msg: "Password must include a letter and a number" });
    }

    const exists = await User.findOne({ email: trimmedEmail });
    if (exists) {
      return res.status(409).json({ ok: false, msg: "Email already registered" });
    }

    const user = await User.create({
      fname: trimmedFname,
      lname: trimmedLname,
      email: trimmedEmail,
      phone: trimmedPhone,
      country: trimmedCountry,
      password,
      role: "user",
    });

    const token = generateToken(user._id, user.role);

    const formatted = formatUser(user);
    notify.usersInvalidate();

    return res.status(201).json({
      ok: true,
      msg: "Welcome",
      token,
      user: formatted,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ ok: false, msg: "Registration failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email?.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      return res.status(400).json({ ok: false, msg: "Email and password are required" });
    }

    const user = await User.findOne({ email: trimmedEmail }).select("+password");
    if (!user) {
      return res.status(401).json({ ok: false, msg: "Invalid email or password" });
    }
    if (user.suspended) {
      return res.status(403).json({ ok: false, msg: "Account suspended by admin" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ ok: false, msg: "Invalid email or password" });
    }

    const token = generateToken(user._id, user.role);

    return res.json({
      ok: true,
      msg: user.role === "admin" ? "Welcome, admin" : "Welcome back",
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ ok: false, msg: "Login failed" });
  }
};

exports.me = async (req, res) => {
  return res.json({
    ok: true,
    user: formatUser(req.user),
  });
};
