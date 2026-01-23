import express from 'express';
import { createEvents } from 'ics';
import { supabase } from '../services/supabase.js';

const router = express.Router();

router.get('/airbnb.ics', async (req, res) => {
  try {
    // Fetch all confirmed bookings from your database
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('check_in, check_out, status')
      .eq('status', 'confirmed');

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Handle empty bookings - return empty calendar
    if (!bookings || bookings.length === 0) {
      console.log('No confirmed bookings found, returning empty calendar');
      const { error: icsError, value } = createEvents([]);

      if (icsError) throw icsError;

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bookastay.ics"');
      return res.send(value);
    }

    // Convert to iCal format
    const events = bookings.map(booking => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);

      return {
        start: [
          checkIn.getFullYear(),
          checkIn.getMonth() + 1,
          checkIn.getDate()
        ],
        end: [
          checkOut.getFullYear(),
          checkOut.getMonth() + 1,
          checkOut.getDate()
        ],
        title: 'Unavailable',
        description: 'Booked via Bookastay',
        status: 'CONFIRMED'
      };
    });

    console.log(`Generating calendar with ${events.length} event(s)`);
    const { error: icsError, value } = createEvents(events);

    if (icsError) {
      console.error('iCal creation error:', icsError);
      throw icsError;
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookastay.ics"');
    res.send(value);

  } catch (error) {
    console.error('iCal generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

export default router;