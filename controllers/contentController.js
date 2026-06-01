import { supabaseAdmin } from '../services/supabase.js';

// ==========================================
// PUBLIC — Get all site content
// ==========================================
export const getAllContent = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_content')
      .select('key, title, value, updated_at');

    if (error) throw error;

    // Convert array to key-map for easy frontend use
    const contentMap = {};
    (data || []).forEach(item => {
      contentMap[item.key] = { title: item.title, value: item.value, updated_at: item.updated_at };
    });

    res.status(200).json({ success: true, content: contentMap });
  } catch (err) {
    console.error('getAllContent error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

// ==========================================
// PUBLIC — Get single content by key
// ==========================================
export const getContent = async (req, res) => {
  try {
    const { key } = req.params;

    const { data, error } = await supabaseAdmin
      .from('site_content')
      .select('*')
      .eq('key', key)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    res.status(200).json({ success: true, content: data });
  } catch (err) {
    console.error('getContent error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

// ==========================================
// ADMIN — Upsert (create or update) content
// ==========================================
export const upsertContent = async (req, res) => {
  try {
    const { key } = req.params;
    const { title, value } = req.body;

    if (!value) {
      return res.status(400).json({ success: false, message: 'value is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('site_content')
      .upsert(
        { key, title: title || key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, content: data });
  } catch (err) {
    console.error('upsertContent error:', err);
    res.status(500).json({ success: false, message: 'Failed to update content' });
  }
};
