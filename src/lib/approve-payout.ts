export async function approveAndTransfer(actions: { approve: () => Promise<void>; transfer: () => Promise<string> }) {
  await actions.approve();
  try {
    return { message: await actions.transfer() };
  } catch (error) {
    return { message: `Timesheet approved; payment needs checking. ${error instanceof Error ? error.message : "Review the PayPal dashboard before retrying."}` };
  }
}