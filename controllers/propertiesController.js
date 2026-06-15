import { supabaseAdmin } from '../services/supabase.js';
import { uploadBuffer } from '../services/cloudinaryClient.js';

// ==========================================
// PUBLIC — Get active properties
// ==========================================
export const getProperties = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('property_settings')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.status(200).json({ success: true, properties: data || [] });
  } catch (err) {
    console.error('getProperties error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
};

// ==========================================
// ADMIN — Get all properties (incl. inactive)
// ==========================================
export const getAllPropertiesAdmin = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('property_settings')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.status(200).json({ success: true, properties: data || [] });
  } catch (err) {
    console.error('getAllPropertiesAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
};

// ==========================================
// ADMIN — Create property
// ==========================================
export const createProperty = async (req, res) => {
  try {
    const {
      room_key, name, subtitle, description, category,
      base_price, max_guests, min_nights, bedrooms, bathrooms,
      amenities, sort_order, ical_urls, property_group, blocks_group
    } = req.body;

    if (!room_key || !name || !base_price) {
      return res.status(400).json({ success: false, message: 'room_key, name, and base_price are required' });
    }

    // ical_urls can arrive as array or newline-separated string
    let parsedIcalUrls = [];
    if (Array.isArray(ical_urls)) {
      parsedIcalUrls = ical_urls.filter(Boolean);
    } else if (typeof ical_urls === 'string' && ical_urls.trim()) {
      parsedIcalUrls = ical_urls.split('\n').map(s => s.trim()).filter(Boolean);
    }

    const { data, error } = await supabaseAdmin
      .from('property_settings')
      .insert([{
        room_key: room_key.toLowerCase().replace(/\s+/g, '_'),
        name,
        subtitle: subtitle || '',
        description: description || '',
        category: category || 'Private Room',
        base_price: Number(base_price),
        max_guests: Number(max_guests) || 2,
        min_nights: Number(min_nights) || 1,
        bedrooms: Number(bedrooms) || 1,
        bathrooms: Number(bathrooms) || 1,
        amenities: amenities || [],
        images: [],
        is_active: true,
        sort_order: Number(sort_order) || 99,
        ical_urls: parsedIcalUrls,
        property_group: property_group || null,
        blocks_group: blocks_group === true || blocks_group === 'true',
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, message: `Room key "${room_key}" already exists` });
      }
      throw error;
    }

    res.status(201).json({ success: true, property: data });
  } catch (err) {
    console.error('createProperty error:', err);
    res.status(500).json({ success: false, message: 'Failed to create property' });
  }
};

// ==========================================
// ADMIN — Update property
// ==========================================
export const updateProperty = async (req, res) => {
  try {
    const { room_key } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    if (updates.base_price) updates.base_price = Number(updates.base_price);
    if (updates.max_guests) updates.max_guests = Number(updates.max_guests);
    if (updates.min_nights) updates.min_nights = Number(updates.min_nights);
    if (updates.bedrooms) updates.bedrooms = Number(updates.bedrooms);
    if (updates.bathrooms) updates.bathrooms = Number(updates.bathrooms);
    if (updates.sort_order !== undefined) updates.sort_order = Number(updates.sort_order);
    if (updates.blocks_group !== undefined) updates.blocks_group = updates.blocks_group === true || updates.blocks_group === 'true';
    if (updates.ical_urls !== undefined && typeof updates.ical_urls === 'string') {
      updates.ical_urls = updates.ical_urls.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (updates.property_group === '') updates.property_group = null;

    // Don't allow changing the primary key via this route
    delete updates.room_key;

    const { data, error } = await supabaseAdmin
      .from('property_settings')
      .update(updates)
      .eq('room_key', room_key)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Property not found' });

    res.status(200).json({ success: true, property: data });
  } catch (err) {
    console.error('updateProperty error:', err);
    res.status(500).json({ success: false, message: 'Failed to update property' });
  }
};

// ==========================================
// ADMIN — Delete (deactivate) property
// ==========================================
export const deleteProperty = async (req, res) => {
  try {
    const { room_key } = req.params;

    const { error } = await supabaseAdmin
      .from('property_settings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('room_key', room_key);

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Property deactivated successfully' });
  } catch (err) {
    console.error('deleteProperty error:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate property' });
  }
};

// ==========================================
// ADMIN — Upload image to Cloudinary + add to property
// ==========================================
export const uploadPropertyImage = async (req, res) => {
  try {
    const { room_key } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const uploaded = await uploadBuffer(req.file.buffer, `property_${room_key}_${Date.now()}`);
    const imageUrl = uploaded.secure_url || uploaded.url;

    if (!imageUrl) {
      return res.status(500).json({ success: false, message: 'Upload succeeded but URL not returned' });
    }

    // Fetch current images and append
    const { data: current } = await supabaseAdmin
      .from('property_settings')
      .select('images')
      .eq('room_key', room_key)
      .single();

    const currentImages = current?.images || [];
    const newImages = [...currentImages, imageUrl];

    const { data, error } = await supabaseAdmin
      .from('property_settings')
      .update({ images: newImages, updated_at: new Date().toISOString() })
      .eq('room_key', room_key)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, url: imageUrl, property: data });
  } catch (err) {
    console.error('uploadPropertyImage error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload image: ' + err.message });
  }
};

// ==========================================
// ADMIN — Remove specific image from property
// ==========================================
export const removePropertyImage = async (req, res) => {
  try {
    const { room_key } = req.params;
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ success: false, message: 'image_url is required' });
    }

    const { data: current } = await supabaseAdmin
      .from('property_settings')
      .select('images')
      .eq('room_key', room_key)
      .single();

    const filtered = (current?.images || []).filter(url => url !== image_url);

    const { data, error } = await supabaseAdmin
      .from('property_settings')
      .update({ images: filtered, updated_at: new Date().toISOString() })
      .eq('room_key', room_key)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, property: data });
  } catch (err) {
    console.error('removePropertyImage error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove image' });
  }
};
