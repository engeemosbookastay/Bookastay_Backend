import axios from 'axios';
import ical from 'node-ical';
import { supabaseAdmin } from '../services/supabase.js';

export async function syncFromAirbnb() {
  try {
    console.log('Starting Airbnb calendar sync...');
    
    // Get Airbnb calendar URL from database
    const { data: syncConfig, error: configError } = await supabaseAdmin
      .from('calendar')
      .select('calendar_url')
      .eq('platform', 'airbnb')
      .single();

    if (configError) {
      console.error('Error fetching calendar config:', configError);
      return { success: false, error: configError };
    }

    if (!syncConfig?.calendar_url) {
      console.log('No Airbnb calendar URL configured');
      return { success: false, error: 'No calendar URL' };
    }

    // Fetch Airbnb calendar
    console.log('Fetching Airbnb calendar...');
    const response = await axios.get(syncConfig.calendar_url);
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
      const checkIn = startDate.toISOString().split('T')[0];
      const checkOut = endDate.toISOString().split('T')[0];
      const transactionRef = event.uid;

      // CHECK 1: Does this booking already exist by transaction_ref?
      const { data: existingByRef, error: refError } = await supabaseAdmin
        .from('bookings')
        .select('id, check_in, check_out, transaction_ref')
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
        // Check if dates have changed (Airbnb updated the booking)
        if (existingByRef.check_in !== checkIn || existingByRef.check_out !== checkOut) {
          console.log('Updating Airbnb booking', transactionRef, ':', checkIn, 'to', checkOut);
          
          const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .update({
              check_in: checkIn,
              check_out: checkOut,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingByRef.id);

          if (updateError) {
            console.error('Error updating booking:', updateError);
            errorCount++;
          } else {
            updatedBookingsCount++;
          }
        } else {
          // Same booking, same dates - skip silently
          existingBookingsCount++;
        }
        continue; // Move to next event
      }

      // CHECK 2: Is there any booking with these exact dates (from any source)?
      const { data: existingByDates, error: datesError } = await supabaseAdmin
        .from('bookings')
        .select('id, source, check_in, check_out, transaction_ref')
        .eq('check_in', checkIn)
        .eq('check_out', checkOut)
        .eq('status', 'confirmed');

      if (datesError) {
        console.error('Error checking existing booking by dates:', datesError);
        errorCount++;
        continue;
      }

      if (existingByDates && existingByDates.length > 0) {
        console.log('Booking already exists for', checkIn, 'to', checkOut, '- Source:', existingByDates[0].source);
        existingBookingsCount++;
        continue; // Skip duplicate
      }

      // CHECK 3: Check for overlapping bookings
      const { data: overlappingBookings, error: overlapError } = await supabaseAdmin
        .from('bookings')
        .select('id, source, check_in, check_out')
        .eq('status', 'confirmed')
        .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`);

      if (overlapError) {
        console.error('Error checking overlapping bookings:', overlapError);
        errorCount++;
        continue;
      }

      if (overlappingBookings && overlappingBookings.length > 0) {
        console.log('Overlapping booking found for', checkIn, 'to', checkOut);
        console.log('Existing:', overlappingBookings[0].check_in, 'to', overlappingBookings[0].check_out, '-', overlappingBookings[0].source);
        existingBookingsCount++;
        continue; // Skip to prevent double-booking
      }

      // ALL CHECKS PASSED - Safe to insert new booking
      console.log('Adding NEW Airbnb booking:', checkIn, 'to', checkOut);
      
      const bookingData = {
        check_in: checkIn,
        check_out: checkOut,
        status: 'confirmed',
        source: 'airbnb',
        transaction_ref: transactionRef,
        name: 'Airbnb Guest',
        email: 'airbnb@sync.bookastay.com',
        phone: '0000000000',
        room_type: 'entire',
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
        console.error('Failed to insert Airbnb booking:', insertError);
        console.error('Error details:', JSON.stringify(insertError, null, 2));
        errorCount++;
      } else {
        console.log('Successfully added booking (ID:', insertedData[0]?.id, ')');
        newBookingsCount++;
      }
    }

    // Update last sync time
    await supabaseAdmin
      .from('calendar')
      .update({ last_synced: new Date().toISOString() })
      .eq('platform', 'airbnb');

    // Summary Report
    console.log('');
    console.log('Airbnb calendar sync completed!');
    console.log('==========================================');
    console.log('SYNC SUMMARY:');
    console.log('  New bookings added:', newBookingsCount);
    console.log('  Bookings updated:', updatedBookingsCount);
    console.log('  Existing bookings skipped:', existingBookingsCount);
    console.log('  Errors encountered:', errorCount);
    console.log('  Total events processed:', Object.values(events).filter(e => e.type === 'VEVENT').length);
    console.log('==========================================');
    console.log('');

    return {
      success: true,
      newBookings: newBookingsCount,
      updatedBookings: updatedBookingsCount,
      existingBookings: existingBookingsCount,
      errors: errorCount,
      totalProcessed: Object.values(events).filter(e => e.type === 'VEVENT').length
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