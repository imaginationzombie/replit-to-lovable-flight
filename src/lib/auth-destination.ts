export function safeAuthDestination(next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return "/account";
  return next;
}