function formatUser(user) {
  const json = user.toJSON();
  let assignedStaffId = null;
  let assignedStaffName = null;

  if (user.assignedStaff) {
    if (typeof user.assignedStaff === "object" && user.assignedStaff._id) {
      assignedStaffId = user.assignedStaff._id.toString();
      assignedStaffName =
        user.assignedStaff.name ||
        `${user.assignedStaff.fname || ""} ${user.assignedStaff.lname || ""}`.trim();
    } else {
      assignedStaffId = user.assignedStaff.toString();
    }
  } else if (json.assignedStaff) {
    assignedStaffId = json.assignedStaff.toString();
  }

  return {
    id: json.id,
    email: json.email,
    fname: json.fname,
    lname: json.lname,
    name: json.name,
    phone: json.phone,
    country: json.country,
    role: json.role,
    suspended: json.suspended,
    forceOutcome: json.forceOutcome,
    profitPercent: json.profitPercent ?? null,
    lossPercent: json.lossPercent ?? 100,
    kyc: json.kyc,
    createdAt: new Date(json.createdAt).getTime(),
    wallet: json.wallet,
    assignedStaffId,
    assignedStaffName,
  };
}

module.exports = formatUser;
