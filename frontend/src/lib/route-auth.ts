import type { Role } from "@/context/store";

/** Default landing route after login for each role. */
export function homePathForRole(role: Role): "/admin" | "/portfolio" {
  return role === "admin" || role === "staff" ? "/admin" : "/portfolio";
}
