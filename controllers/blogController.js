import { supabaseAdmin } from '../services/supabase.js';
import { uploadBuffer } from '../services/cloudinaryClient.js';

const generateSlug = (title) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
};

// ==========================================
// PUBLIC — Get published posts
// ==========================================
export const getPublishedPosts = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('date', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, posts: data || [] });
  } catch (err) {
    console.error('getPublishedPosts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
};

// ==========================================
// PUBLIC — Get single published post by slug
// ==========================================
export const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.status(200).json({ success: true, post: data });
  } catch (err) {
    console.error('getPostBySlug error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

// ==========================================
// ADMIN — Get all posts (incl. drafts)
// ==========================================
export const getAllPostsAdmin = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, posts: data || [] });
  } catch (err) {
    console.error('getAllPostsAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
};

// ==========================================
// ADMIN — Create post
// ==========================================
export const createPost = async (req, res) => {
  try {
    const { title, slug, category, author, excerpt, content, image, published, date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .insert([{
        slug: (slug && slug.trim() ? generateSlug(slug) : generateSlug(title)),
        title,
        category: category || '',
        author: author || '',
        excerpt: excerpt || '',
        content: content || '',
        image: image || '',
        published: published === true || published === 'true',
        date: date || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, message: 'A post with this slug already exists' });
      }
      throw error;
    }

    res.status(201).json({ success: true, post: data });
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};

// ==========================================
// ADMIN — Update post
// ==========================================
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    if (updates.slug !== undefined) updates.slug = generateSlug(updates.slug);
    if (updates.published !== undefined) updates.published = updates.published === true || updates.published === 'true';

    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Post not found' });

    res.status(200).json({ success: true, post: data });
  } catch (err) {
    console.error('updatePost error:', err);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
};

// ==========================================
// ADMIN — Delete post
// ==========================================
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('deletePost error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
};

// ==========================================
// ADMIN — Upload cover image to Cloudinary
// ==========================================
export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const uploaded = await uploadBuffer(req.file.buffer, `blog_${Date.now()}`);
    const imageUrl = uploaded.secure_url || uploaded.url;

    if (!imageUrl) {
      return res.status(500).json({ success: false, message: 'Upload succeeded but URL not returned' });
    }

    res.status(200).json({ success: true, url: imageUrl });
  } catch (err) {
    console.error('uploadBlogImage error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload image: ' + err.message });
  }
};
