const storage = require('../services/storage');

async function listBookings(req, res) {
  try {
    const bookings = await storage.listBookings();
    return res.json({ bookings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getBooking(req, res) {
  try {
    const id = req.params.id;
    const b = await storage.getBooking(id);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    return res.json({ booking: b });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateBookingStatus(req, res) {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!['PENDING','CONFIRMED','CANCELLED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updated = await storage.updateBooking(id, { status });
    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    return res.json({ booking: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function stats(req, res) {
  try {
    const bookings = await storage.listBookings();
    const total = bookings.length;
    const confirmed = bookings.filter(b => b.status === 'CONFIRMED').length;
    const pending = bookings.filter(b => b.status === 'PENDING').length;
    const cancelled = bookings.filter(b => b.status === 'CANCELLED').length;
    return res.json({ total, confirmed, pending, cancelled });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listBookings, getBooking, updateBookingStatus, stats };
