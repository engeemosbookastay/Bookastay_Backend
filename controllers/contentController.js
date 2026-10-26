import { supabaseAdmin } from '../services/supabase.js';
import { uploadBuffer } from '../services/cloudinaryClient.js';

// ==========================================
// PUBLIC — Get all site content
// ==========================================
export const getAllContent = async (req, res) => {
  res.set('Cache-Control', 'no-store');
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
  res.set('Cache-Control', 'no-store');
  try {
    const { key } = req.params;

    const { data, error } = await supabaseAdmin
      .from('site_content')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    // A real DB error must not look like "never saved" — the frontend only
    // falls back to bundled defaults on 404.
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    res.status(200).json({ success: true, content: data });
  } catch (err) {
    console.error('getContent error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch content' });
  }
};

// Normalise House Rules before storing: keep rule + paragraph order exactly as
// the admin arranged them, fold the legacy "extra" field into paragraphs, and
// drop empty paragraphs. Unknown fields (details, etc.) are preserved.
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const normalizeHouseRules = (value) => {
  if (!value || !Array.isArray(value.rules)) return null;
  const rules = value.rules
    .filter(r => r && typeof r === 'object')
    .map(r => {
      const paragraphs = (Array.isArray(r.paragraphs) ? r.paragraphs : [])
        .map(str)
        .filter(p => p.trim());
      const extra = str(r.extra).trim();
      if (extra && !paragraphs.includes(extra)) paragraphs.unshift(extra);
      return {
        ...r,
        title: str(r.title).trim(),
        category: str(r.category).trim(),
        content: str(r.content),
        extra: '',
        paragraphs,
        details: Array.isArray(r.details) ? r.details : [],
      };
    })
    .filter(r => r.title || r.content.trim() || r.paragraphs.length);
  return { ...value, rules };
};

// ==========================================
// ADMIN — Upsert (create or update) content
// ==========================================
export const upsertContent = async (req, res) => {
  try {
    const { key } = req.params;
    const { title } = req.body;
    let { value } = req.body;

    if (!value) {
      return res.status(400).json({ success: false, message: 'value is required' });
    }

    if (key === 'house_rules') {
      value = normalizeHouseRules(value);
      if (!value) {
        return res.status(400).json({ success: false, message: 'house_rules must be { rules: [...] }' });
      }
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

// ==========================================
// ADMIN — Upload a content image (e.g. homepage carousel slides)
// Mirrors blogController.uploadBlogImage: multipart field "image" → Cloudinary.
// ==========================================
export const uploadContentImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const uploaded = await uploadBuffer(req.file.buffer, `content_${Date.now()}`);
    const imageUrl = uploaded.secure_url || uploaded.url;

    if (!imageUrl) {
      return res.status(500).json({ success: false, message: 'Upload succeeded but URL not returned' });
    }

    res.status(200).json({ success: true, url: imageUrl });
  } catch (err) {
    console.error('uploadContentImage error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload image: ' + err.message });
  }
};
