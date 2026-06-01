import { supabaseAdmin } from '../services/supabase.js';

// ==========================================
// PUBLIC — Validate a discount code
// ==========================================
export const validateDiscount = async (req, res) => {
  try {
    const { code, room_type, nights, amount } = req.body;

    if (!code) return res.status(400).json({ success: false, message: 'Discount code is required' });

    const { data, error } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(200).json({ success: false, valid: false, message: 'Invalid or expired discount code' });
    }

    // Check expiry
    if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
      return res.status(200).json({ success: false, valid: false, message: 'This discount code has expired' });
    }

    // Check usage limit
    if (data.usage_limit !== null && data.times_used >= data.usage_limit) {
      return res.status(200).json({ success: false, valid: false, message: 'This discount code has reached its usage limit' });
    }

    // Check room type restriction
    if (data.applies_to && data.applies_to.length > 0 && room_type) {
      if (!data.applies_to.includes(room_type)) {
        return res.status(200).json({
          success: false, valid: false,
          message: `This code only applies to: ${data.applies_to.join(', ')}`
        });
      }
    }

    // Check min nights
    if (nights && data.min_nights && nights < data.min_nights) {
      return res.status(200).json({
        success: false, valid: false,
        message: `This code requires a minimum of ${data.min_nights} nights`
      });
    }

    // Check min amount
    if (amount && data.min_amount && amount < data.min_amount) {
      return res.status(200).json({
        success: false, valid: false,
        message: `This code requires a minimum booking of ₦${Number(data.min_amount).toLocaleString()}`
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (data.type === 'percentage') {
      discountAmount = Math.round((amount || 0) * (data.value / 100));
    } else {
      discountAmount = data.value;
    }

    res.status(200).json({
      success: true,
      valid: true,
      discount: {
        id: data.id,
        code: data.code,
        type: data.type,
        value: data.value,
        description: data.description,
        discount_amount: discountAmount,
      },
      message: `Code applied! You save ₦${discountAmount.toLocaleString()}`,
    });
  } catch (err) {
    console.error('validateDiscount error:', err);
    res.status(500).json({ success: false, message: 'Failed to validate code' });
  }
};

// ==========================================
// ADMIN — Get all discount codes
// ==========================================
export const getAllDiscounts = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, discounts: data || [] });
  } catch (err) {
    console.error('getAllDiscounts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch discount codes' });
  }
};

// ==========================================
// ADMIN — Create discount code
// ==========================================
export const createDiscount = async (req, res) => {
  try {
    const {
      code, type, value, applies_to, min_nights,
      min_amount, expiry_date, usage_limit, description
    } = req.body;

    if (!code || !type || value === undefined) {
      return res.status(400).json({ success: false, message: 'code, type, and value are required' });
    }
    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be percentage or fixed' });
    }
    if (type === 'percentage' && (value <= 0 || value > 100)) {
      return res.status(400).json({ success: false, message: 'Percentage must be between 1 and 100' });
    }

    const { data, error } = await supabaseAdmin
      .from('discount_codes')
      .insert([{
        code: code.toUpperCase().trim(),
        type,
        value: Number(value),
        applies_to: applies_to || null,
        min_nights: Number(min_nights) || 1,
        min_amount: Number(min_amount) || 0,
        expiry_date: expiry_date || null,
        usage_limit: usage_limit ? Number(usage_limit) : null,
        description: description || '',
        is_active: true,
        times_used: 0,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, message: 'Discount code already exists' });
      }
      throw error;
    }

    res.status(201).json({ success: true, discount: data });
  } catch (err) {
    console.error('createDiscount error:', err);
    res.status(500).json({ success: false, message: 'Failed to create discount code' });
  }
};

// ==========================================
// ADMIN — Update discount code
// ==========================================
export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    if (updates.code) updates.code = updates.code.toUpperCase().trim();
    if (updates.value) updates.value = Number(updates.value);

    const { data, error } = await supabaseAdmin
      .from('discount_codes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Discount code not found' });

    res.status(200).json({ success: true, discount: data });
  } catch (err) {
    console.error('updateDiscount error:', err);
    res.status(500).json({ success: false, message: 'Failed to update discount code' });
  }
};

// ==========================================
// ADMIN — Delete discount code
// ==========================================
export const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('discount_codes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Discount code deleted' });
  } catch (err) {
    console.error('deleteDiscount error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete discount code' });
  }
};

// ==========================================
// Internal — Increment usage count (called after successful booking)
// ==========================================
export const incrementDiscountUsage = async (code) => {
  if (!code) return;
  try {
    const { data } = await supabaseAdmin
      .from('discount_codes')
      .select('times_used')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (data) {
      await supabaseAdmin
        .from('discount_codes')
        .update({ times_used: (data.times_used || 0) + 1 })
        .eq('code', code.toUpperCase().trim());
    }
  } catch (err) {
    console.error('incrementDiscountUsage error:', err.message);
  }
};
