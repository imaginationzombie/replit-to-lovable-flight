export function canSendConfirmation(isAdmin: boolean, status: string) {
  return isAdmin && status === "confirmed";
}