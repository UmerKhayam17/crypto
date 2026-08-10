const User = require("../model/User");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fname = process.env.ADMIN_FNAME?.trim() || "Admin";
  const lname = process.env.ADMIN_LNAME?.trim() || "User";

  if (!email || !password) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed");
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") {
      console.log(`Admin user already exists: ${email}`);
      return;
    }
    // Never silently promote an existing non-admin account.
    // Only create admin when the email is free.
    console.warn(
      `Refusing to promote existing ${existing.role} account ${email} to admin. Use a unique ADMIN_EMAIL.`
    );
    return;
  }

  await User.create({
    email,
    password,
    fname,
    lname,
    role: "admin",
    country: "US",
    phone: "",
    kyc: { status: "approved" },
  });

  console.log(`Admin user created: ${email}`);
}

module.exports = seedAdmin;
