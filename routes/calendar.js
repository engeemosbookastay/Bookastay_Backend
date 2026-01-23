import express from 'express';
import { createEvents } from 'ics';
import { supabaseAdmin } from '../services/supabase.js';

const router = express.Router();

// Helper function to generate iCal events from bookings
const generateICalEvents = (bookings) => {
  return bookings.map(booking => {
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
      description: `Booked via ${booking.source || 'Bookastay'}`,
      status: 'CONFIRMED'
    };
  });
};

// Helper function to send iCal response
const sendICalResponse = (res, events, filename) => {
  console.log(`Generating ${filename} with ${events.length} event(s)`);
  const { error, value } = createEvents(events);

  if (error) {
    console.error('iCal creation error:', error);
    throw error;
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(value);
};

// Entire Apartment Calendar - Shows ALL bookings (any booking blocks entire apartment)
router.get('/ical/entire.ics', async (req, res) => {
  try {
    console.log('Generating Entire Apartment calendar...');

    // Get the date 1 year from now
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const maxDate = oneYearFromNow.toISOString().split('T')[0];

    // Fetch ALL confirmed bookings (entire, room1, room2) within the next year
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, status, room_type, source')
      .eq('status', 'confirmed')
      .lte('check_in', maxDate);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    const events = bookings && bookings.length > 0 ? generateICalEvents(bookings) : [];
    sendICalResponse(res, events, 'entire-apartment.ics');

  } catch (error) {
    console.error('iCal generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

// Room 1 Calendar - Shows 'entire' and 'room1' bookings
router.get('/ical/room1.ics', async (req, res) => {
  try {
    console.log('Generating Room 1 calendar...');

    // Get the date 1 year from now
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const maxDate = oneYearFromNow.toISOString().split('T')[0];

    // Fetch bookings where room_type is 'entire' or 'room1' within the next year
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, status, room_type, source')
      .eq('status', 'confirmed')
      .in('room_type', ['entire', 'room1'])
      .lte('check_in', maxDate);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    const events = bookings && bookings.length > 0 ? generateICalEvents(bookings) : [];
    sendICalResponse(res, events, 'room1.ics');

  } catch (error) {
    console.error('iCal generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

// Room 2 Calendar - Shows 'entire' and 'room2' bookings
router.get('/ical/room2.ics', async (req, res) => {
  try {
    console.log('Generating Room 2 calendar...');

    // Get the date 1 year from now
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const maxDate = oneYearFromNow.toISOString().split('T')[0];

    // Fetch bookings where room_type is 'entire' or 'room2' within the next year
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, status, room_type, source')
      .eq('status', 'confirmed')
      .in('room_type', ['entire', 'room2'])
      .lte('check_in', maxDate);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    const events = bookings && bookings.length > 0 ? generateICalEvents(bookings) : [];
    sendICalResponse(res, events, 'room2.ics');

  } catch (error) {
    console.error('iCal generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

// Legacy endpoint for backward compatibility
router.get('/airbnb.ics', async (req, res) => {
  console.log('Legacy endpoint called, redirecting to /ical/entire.ics logic...');

  try {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const maxDate = oneYearFromNow.toISOString().split('T')[0];

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out, status, room_type, source')
      .eq('status', 'confirmed')
      .lte('check_in', maxDate);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    const events = bookings && bookings.length > 0 ? generateICalEvents(bookings) : [];
    sendICalResponse(res, events, 'bookastay.ics');

  } catch (error) {
    console.error('iCal generation error:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

export default router;