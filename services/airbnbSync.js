import axios from 'axios';
import ical from 'node-ical';
import { supabaseAdmin } from '../services/supabase.js';

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

          const startDate = new Date(event.start);
          const endDate = new Date(event.end);

          // Skip events more than 1 year in the future
          if (startDate > oneYearFromNow) {
            console.log(`Skipping event starting ${startDate.toISOString().split('T')[0]} (beyond 1 year)`);
            continue;
          }

          const checkIn = startDate.toISOString().split('T')[0];
          const checkOut = endDate.toISOString().split('T')[0];
          const transactionRef = event.uid;

          totalEventsProcessed++;

          // CHECK 1: Does this booking already exist by transaction_ref?
          const { data: existingByRef, error: refError } = await supabaseAdmin
            .from('bookings')
            .select('id, check_in, check_out, transaction_ref, room_type')
            .eq('transaction_ref', transactionRef)
            .eq('source', 'airbnb')
            .maybeSingle();

          if (refError) {
            console.error('Error checking existing booking by ref:', refError);
            errorCount++;
            continue;
          }

          // If booking exists with same transaction_ref
          if (existingByRef) {
            // Check if dates or room_type have changed
            if (existingByRef.check_in !== checkIn || existingByRef.check_out !== checkOut || existingByRef.room_type !== config.room_type) {
              console.log(`Updating Airbnb booking ${transactionRef} for ${config.room_type}: ${checkIn} to ${checkOut}`);

              const { error: updateError } = await supabaseAdmin
                .from('bookings')
                .update({
                  check_in: checkIn,
                  check_out: checkOut,
                  room_type: config.room_type
                })
                .eq('id', existingByRef.id);

              if (updateError) {
                console.error('Error updating booking:', updateError);
                errorCount++;
              } else {
                updatedBookingsCount++;
              }
            } else {
              // Same booking, same dates, same room - skip silently
              existingBookingsCount++;
            }
            continue; // Move to next event
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
          console.log(`Adding NEW Airbnb booking for ${config.room_type}: ${checkIn} to ${checkOut}`);

          const bookingData = {
            check_in: checkIn,
            check_out: checkOut,
            status: 'confirmed',
            source: 'airbnb',
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