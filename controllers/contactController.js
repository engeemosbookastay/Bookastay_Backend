const { supabase } = require('../services/supabase');

const createContact = async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields: name, email, subject, message' });
  }

  try {
    const { data, error } = await supabase
      .from('Contact')
      .insert([{ name, email, subject, message }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ message: 'Contact form submitted successfully', data });
  } catch (err) {
    console.error('createContact error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { createContact };
