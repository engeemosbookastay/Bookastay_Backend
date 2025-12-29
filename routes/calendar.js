import express from 'express';
import { createEvents } from 'ics';
import { supabase } from '../services/supabase.js';

const router = express.Router();

router.get('/airbnb.ics', async (req, res) => {
  try {
    // Fetch all confirmed bookings from your database
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date, status')
      .eq('status', 'confirmed');

    if (error) throw error;

    // Convert to iCal format
    const events = bookings.map(booking => {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      
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

    const { error: icsError, value } = createEvents(events);
    
    if (icsError) throw icsError;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookastay.ics"');
    res.send(value);

  } catch (error) {
    console.error('iCal generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

export default router;