// Normalizes Nigerian phone numbers to international format (234XXXXXXXXXX), no leading +
export const normalizePhone = (phone) => {
  let p = String(phone || '').replace(/[\s-]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '234' + p.slice(1);
  return p;
};
