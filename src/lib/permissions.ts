export type UserRole = "advisor" | "admin" | "owner";

export function isAdvisor(role: UserRole): boolean {
  return role === "advisor";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isOwner(role: UserRole): boolean {
  return role === "owner";
}

export function canEditUniversities(role: UserRole): boolean {
  return role === "admin" || role === "owner";
}

export function canAddUniversities(role: UserRole): boolean {
  return role === "admin" || role === "owner";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin" || role === "owner";
}

export function canChangeBranding(role: UserRole): boolean {
  return role === "owner";
}
