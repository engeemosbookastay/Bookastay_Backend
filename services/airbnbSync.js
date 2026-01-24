import axios from 'axios';
import ical from 'node-ical';
import { supabaseAdmin } from '../services/supabase.js';

/**
 * Parse iCal date correctly without timezone conversion.
 * iCal dates can be either:
 * - DATE-only: YYYYMMDD (e.g., 20250407)
 * - DATE-TIME: YYYYMMDDTHHMMSSZ
 *
 * For Airbnb, dates are typically DATE-only, representing calendar days.
 * We extract the date string directly to avoid timezone shifts.
 */
function parseICalDate(icalDate) {
  // If it's already a Date object from node-ical
  if (icalDate instanceof Date) {
    // Check if it has a dateOnly property (node-ical sets this for VALUE=DATE)
    if (icalDate.dateOnly) {
      // Extract YYYY-MM-DD directly from the date parts to avoid timezone issues
      const year = icalDate.getFullYear();
      const month = String(icalDate.getMonth() + 1).padStart(2, '0');
      const day = String(icalDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // For datetime values, use UTC date to avoid local timezone shifts
    return icalDate.toISOString().split('T')[0];
  }

  // If it's a string (YYYYMMDD format)
  if (typeof icalDate === 'string') {
    const cleaned = icalDate.replace(/[^0-9]/g, '').substring(0, 8);
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
    }
  }

  // Fallback: try to parse as date
  const date = new Date(icalDate);
  return date.toISOString().split('T')[0];
}

/**
 * Subtract one day from a YYYY-MM-DD date string.
 * Used for DTEND which is exclusive (checkout day, not last night stayed).
 */
function subtractOneDay(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
}

export async function syncFromAirbnb() {
  try {
    console.log('Starting Airbnb calendar sync from multiple sources...');

    // Define the 3 Airbnb calendar URLs with their room types
    const calendarConfigs = [
      {
        url: 'https://www.airbnb.com/calendar/ical/1062424467186970425.ics?t=125d88f11e7e456bb36ccd50967bbfe2&locale=en-AU',
        room_type: 'entire',
        name: 'Entire Apartment'
      },
      {
        url: 'https://www.airbnb.com.au/calendar/ical/1073067628849955052.ics?t=8cf36fed668945c6ba7ba75be5da77ab',
        room_type: 'room1',
        name: 'Room 1'
      },
      {
        url: 'https://www.airbnb.com.au/calendar/ical/1062425116260973522.ics?t=c337b7c1c4134ac6b213c601408069ce',
        room_type: 'room2',
        name: 'Room 2'
      }
    ];

    // Calculate 1 year from now for filtering
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    let totalNewBookings = 0;
    let totalExistingBookings = 0;
    let totalUpdatedBookings = 0;
    let totalErrors = 0;
    let totalEventsProcessed = 0;

    // Process each calendar URL
    for (const config of calendarConfigs) {
      console.log(`\n--- Processing ${config.name} calendar ---`);

      try {
        // Fetch Airbnb calendar
        console.log(`Fetching ${config.name} calendar from Airbnb...`);
        const response = await axios.get(config.url);
        const events = ical.parseICS(response.data);

        let newBookingsCount = 0;
        let existingBookingsCount = 0;
        let updatedBookingsCount = 0;
        let errorCount = 0;

        // Process each event
        for (const event of Object.values(events)) {
          if (event.type !== 'VEVENT') continue;

          // Parse dates correctly without timezone conversion
          // DTSTART = check-in day (first night stayed)
          // DTEND = checkout day (exclusive - guest leaves this morning)
          const checkIn = parseICalDate(event.start);
          const dtEnd = parseICalDate(event.end);

          // CRITICAL FIX: DTEND is exclusive in iCal format
          // If guest checks out April 18, DTEND=20250418, but last night is April 17
          // So check_out (last night stayed) = DTEND - 1 day
          const checkOut = subtractOneDay(dtEnd);

          // Skip events more than 1 year in the future
          const checkInDate = new Date(checkIn);
          if (checkInDate > oneYearFromNow) {
            console.log(`Skipping event starting ${checkIn} (beyond 1 year)`);
            continue;
          }

          const airbnbUid = event.uid;
          const transactionRef = event.uid;

          totalEventsProcessed++;

          // CHECK 1: Does this booking already exist by airbnb_uid?
          // This is the primary deduplication check using Airbnb's unique event ID
          const { data: existingByUid, error: uidError } = await supabaseAdmin
            .from('bookings')
            .select('id, check_in, check_out, airbnb_uid, room_type')
            .eq('airbnb_uid', airbnbUid)
            .maybeSingle();

          if (uidError) {
            console.error('Error checking existing booking by UID:', uidError);
            errorCount++;
            continue;
          }

          // If booking exists with same airbnb_uid
          if (existingByUid) {
            // Check if dates or room_type have changed (Airbnb may update bookings)
            if (existingByUid.check_in !== checkIn || existingByUid.check_out !== checkOut || existingByUid.room_type !== config.room_type) {
              console.log(`Updating Airbnb booking ${airbnbUid} for ${config.room_type}: ${checkIn} to ${checkOut}`);

              const { error: updateError } = await supabaseAdmin
                .from('bookings')
                .update({
                  check_in: checkIn,
                  check_out: checkOut,
                  room_type: config.room_type
                })
                .eq('id', existingByUid.id);

              if (updateError) {
                console.error('Error updating booking:', updateError);
                errorCount++;
              } else {
                updatedBookingsCount++;
              }
            } else {
              // Same booking, same dates, same room - skip silently (no duplicate)
              existingBookingsCount++;
            }
            continue; // Move to next event - already synced
          }

          // CHECK 2: Is there a booking from website with same dates and room_type?
          const { data: existingByDates, error: datesError } = await supabaseAdmin
            .from('bookings')
            .select('id, source, check_in, check_out, room_type, transaction_ref')
            .eq('check_in', checkIn)
            .eq('check_out', checkOut)
            .eq('room_type', config.room_type)
            .eq('status', 'confirmed')
            .neq('source', 'airbnb');

          if (datesError) {
            console.error('Error checking existing booking by dates:', datesError);
            errorCount++;
            continue;
          }

          if (existingByDates && existingByDates.length > 0) {
            console.log(`Booking already exists for ${config.room_type} ${checkIn} to ${checkOut} - Source: ${existingByDates[0].source}`);
            existingBookingsCount++;
            continue; // Skip duplicate
          }

          // ALL CHECKS PASSED - Safe to insert new booking
          console.log(`Adding NEW Airbnb booking for ${config.room_type}: ${checkIn} to ${checkOut} (checkout morning: ${dtEnd})`);

          const bookingData = {
            check_in: checkIn,
            check_out: checkOut,
            status: 'confirmed',
            source: 'airbnb',
            airbnb_uid: airbnbUid,
            transaction_ref: transactionRef,
            name: `Airbnb Guest (${config.name})`,
            email: 'airbnb@sync.bookastay.com',
            phone: '0000000000',
            room_type: config.room_type,
            guests: 1,
            price: 0,
            paid_amount: 0,
            payment_status: 'paid',
            provider: 'airbnb',
            id_file_url: 'https://placeholder.com/airbnb-guest-id',
            id_type: 'passport',
            created_at: new Date().toISOString()
          };

          const { data: insertedData, error: insertError } = await supabaseAdmin
            .from('bookings')
            .insert(bookingData)
            .select();

          if (insertError) {
            console.error(`Failed to insert Airbnb booking for ${config.room_type}:`, insertError);
            console.error('Error details:', JSON.stringify(insertError, null, 2));
            errorCount++;
          } else {
            console.log(`Successfully added booking (ID: ${insertedData[0]?.id})`);
            newBookingsCount++;
          }
        }

        // Accumulate totals
        totalNewBookings += newBookingsCount;
        totalExistingBookings += existingBookingsCount;
        totalUpdatedBookings += updatedBookingsCount;
        totalErrors += errorCount;

        console.log(`${config.name} sync: +${newBookingsCount} new, ~${updatedBookingsCount} updated, =${existingBookingsCount} skipped, !${errorCount} errors`);

      } catch (calendarError) {
        console.error(`Error syncing ${config.name}:`, calendarError);
        totalErrors++;
      }
    }

    // Summary Report
    console.log('');
    console.log('==========================================');
    console.log('AIRBNB MULTI-CALENDAR SYNC COMPLETED');
    console.log('==========================================');
    console.log('  New bookings added:', totalNewBookings);
    console.log('  Bookings updated:', totalUpdatedBookings);
    console.log('  Existing bookings skipped:', totalExistingBookings);
    console.log('  Errors encountered:', totalErrors);
    console.log('  Total events processed:', totalEventsProcessed);
    console.log('==========================================');
    console.log('');

    return {
      success: true,
      newBookings: totalNewBookings,
      updatedBookings: totalUpdatedBookings,
      existingBookings: totalExistingBookings,
      errors: totalErrors,
      totalProcessed: totalEventsProcessed
    };

  } catch (error) {
    console.error('Airbnb sync error:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Clean up old past Airbnb bookings
export async function cleanupOldAirbnbBookings() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('Cleaning up old Airbnb bookings...');

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('source', 'airbnb')
      .lt('check_out', today)
      .select();

    if (error) {
      console.error('Error cleaning up old bookings:', error);
      return { success: false, error: error.message };
    }

    const deletedCount = data?.length || 0;
    console.log('Cleaned up', deletedCount, 'old Airbnb booking(s)');
    
    return { success: true, deletedCount };

  } catch (error) {
    console.error('Cleanup error:', error);
    return { success: false, error: error.message };
  }
}

// Manual sync trigger (for testing)
export async function manualSync() {
  console.log('Manual sync triggered');
  return await syncFromAirbnb();
}