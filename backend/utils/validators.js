const nameRe = /^[A-Za-z][A-Za-z\s'-]{1,49}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneRe = /^[+\d][\d\s().-]{6,24}$/;

function validatePassword(password) {
  if (!password || password.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include a letter and a number";
  }
  return null;
}

function validateStaffFields({ fname, lname, email, phone, password, requirePassword }) {
  const trimmedFname = fname?.trim();
  const trimmedLname = lname?.trim();
  const trimmedEmail = email?.trim().toLowerCase();
  const trimmedPhone = phone?.trim();

  if (!nameRe.test(trimmedFname || "")) {
    return { ok: false, msg: "First name: letters only, 2–50 chars" };
  }
  if (!nameRe.test(trimmedLname || "")) {
    return { ok: false, msg: "Last name: letters only, 2–50 chars" };
  }
  if (!emailRe.test(trimmedEmail || "")) {
    return { ok: false, msg: "Enter a valid email address" };
  }
  if (!phoneRe.test(trimmedPhone || "")) {
    return { ok: false, msg: "Enter a valid contact number" };
  }
  if (requirePassword) {
    const pwErr = validatePassword(password);
    if (pwErr) return { ok: false, msg: pwErr };
  } else if (password) {
    const pwErr = validatePassword(password);
    if (pwErr) return { ok: false, msg: pwErr };
  }

  return {
    ok: true,
    data: {
      fname: trimmedFname,
      lname: trimmedLname,
      email: trimmedEmail,
      phone: trimmedPhone,
      password,
    },
  };
}

module.exports = { validateStaffFields, validatePassword };
