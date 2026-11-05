/** Only allow same-site relative redirects after sign-in. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/** Pages that need a sign-in even to view, so the login page can say why it's asking. */
export function isStaffOnlyPath(path: string): boolean {
  return /^\/(reports|needs-assignment|admin|me)(?:[/?#]|$)/.test(path);
}
