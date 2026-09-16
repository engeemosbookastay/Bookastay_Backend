// Booking lead-time rule (Sir Gbenga's request):
//   A guest must book by 9pm the day BEFORE check-in, so the apartment can be
//   prepared for a 2pm check-in. e.g. a booking for the 17th must be made by
//   9pm on the 16th.
//
// The cutoff is anchored to Nigeria time (WAT = UTC+1, no daylight saving),
// NOT the server's UTC clock or the guest's browser — "9pm" means 9pm in
// Abeokuta regardless of where the guest is booking from.

const WAT_OFFSET_MS = 60 * 60 * 1000; // Nigeria is UTC+1 all year (no DST)
const CUTOFF_HOUR = 21;               // 9pm WAT, the day before check-in

// Earliest check-in date (YYYY-MM-DD, in WAT) a guest may still book right now.
//   - before 9pm WAT  → tomorrow is still open (its cutoff is 9pm today)
//   - 9pm WAT or later → tomorrow has closed, so the day after is the earliest
export const minCheckInDate = (now = new Date()) => {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  const addDays = wat.getUTCHours() >= CUTOFF_HOUR ? 2 : 1;
  const earliest = new Date(Date.UTC(
    wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() + addDays
  ));
  return earliest.toISOString().slice(0, 10);
};

// True when a requested check-in is earlier than the lead-time allows.
// YYYY-MM-DD strings compare correctly with a plain <, so no timezone maths
// on the requested date — we only normalise a full ISO string down to its date.
export const isCheckInTooSoon = (checkInStr, now = new Date()) => {
  if (!checkInStr) return false;
  const dateOnly = String(checkInStr).slice(0, 10);
  return dateOnly < minCheckInDate(now);
};

export const LEAD_TIME_MESSAGE =
  'Bookings must be made by 9pm the day before check-in so we can prepare the apartment for you. Please choose a later check-in date.';
