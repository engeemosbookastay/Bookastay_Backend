import axios from 'axios';
import ical from 'node-ical';
import { supabaseAdmin } from '../services/supabase.js';

export async function syncFromAirbnb() {
  try {
    // Get Airbnb calendar URL from database
    const { data: syncConfig, error: configError } = await supabaseAdmin
      .from('calendar')
      .select('calendar_url')
      .eq('platform', 'airbnb')
      .single();

    if (configError) {
      console.error('Error fetching calendar config:', configError);
      return;
    }

    if (!syncConfig?.calendar_url) {
      console.log('No Airbnb calendar URL configured');
      return;
    }

    // Fetch Airbnb calendar
    const response = await axios.get(syncConfig.calendar_url);
    const events = ical.parseICS(response.data);

    // Process each event
    for (const event of Object.values(events)) {
      if (event.type !== 'VEVENT') continue;

      const startDate = new Date(event.start);
      const endDate = new Date(event.end);

      // Check if this booking already exists by checking transaction_ref
      // We'll use the event.uid as the transaction_ref
      const { data: existing } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('transaction_ref', event.uid)
        .eq('source', 'airbnb')
        .single();

      if (!existing) {
        // Create new blocked booking
        const bookingData = {
          check_in: startDate.toISOString().split('T')[0],
          check_out: endDate.toISOString().split('T')[0],
          status: 'confirmed',
          source: 'airbnb',
          transaction_ref: event.uid,
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
          id_type: 'passport'
        };

        console.log('Attempting to insert booking:', bookingData);

        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from('bookings')
          .insert(bookingData)
          .select();

        if (insertError) {
          console.error('Failed to insert Airbnb booking:', insertError);
          console.error('Error details:', JSON.stringify(insertError, null, 2));
        } else {
          console.log(`✓ Successfully added Airbnb booking: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
          console.log('Inserted booking data:', insertedData);
        }
      }
    }

    // Update last sync time
    await supabaseAdmin
      .from('calendar')
      .update({ last_synced: new Date().toISOString() })
      .eq('platform', 'airbnb');

    console.log('Airbnb calendar synced successfully');

  } catch (error) {
    console.error('Airbnb sync error:', error);
  }
}