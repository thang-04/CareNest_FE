export const RECIPIENT_ERROR = 'Chọn đúng một phụ huynh nhận tài khoản';
export const normalizeRecipients = (guardians = []) =>
  guardians.map((g) => ({ ...g, accountRecipient: guardians.length === 1 || g.accountRecipient === true }));
export const selectedRecipients = (guardians = []) => normalizeRecipients(guardians).filter((g) => g.accountRecipient);
export const recipientError = (guardians = []) => (selectedRecipients(guardians).length === 1 ? null : RECIPIENT_ERROR);
