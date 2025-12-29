import { supabase, supabaseAdmin } from "../services/supabase.js";
import bcrypt from "bcryptjs";

const dbClient = supabaseAdmin || supabase;

// ======================
// Email/Password Signup
// ======================
export const signup = async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password || !name)
    return res.status(400).json({ error: "name, email, and password are required" });

  try {
    const { data: existing, error: existsErr } = await dbClient
      .from("Users")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existsErr) return res.status(500).json({ error: "Server error" });
    if (existing && existing.length)
      return res.status(409).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const { data: inserted, error: insertErr } = await dbClient
      .from("Users")
      .insert([{ name, email, password: hashed, provider: "email" }])
      .select()
      .single();

    if (insertErr) return res.status(500).json({ error: "Failed to create user" });

    const safeUser = {
      id: inserted.id,
      name: inserted.name,
      email: inserted.email,
    };

    // ✅ Make sure frontend gets the structure it expects
    return res.status(201).json({
      message: "User created successfully",
      data: { user: safeUser },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ======================
// Email/Password Login
// ======================
export const login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "email and password are required" });

  try {
    const { data: rows, error: fetchErr } = await dbClient
      .from("Users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (fetchErr) return res.status(500).json({ error: "Server error" });

    const user = rows && rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const matches = await bcrypt.compare(password, user.password || "");
    if (!matches) return res.status(401).json({ error: "Invalid credentials" });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    // ✅ Consistent structure for frontend
    return res.json({
      message: "Login successful",
      data: { user: safeUser },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ======================
// Social Login
// ======================
export const socialLogin = async (req, res) => {
  const { provider, redirectUrl } = req.body || {};
  if (!provider)
    return res.status(400).json({ error: "provider is required" });

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl || "http://localhost:4000/auth/callback",
      },
    });

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ url: data.url });
  } catch (err) {
    console.error("Social login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ======================
// OAuth Callback
// ======================
export const socialCallback = async (req, res) => {
  const { access_token } = req.query;
  if (!access_token)
    return res.status(400).json({ error: "access_token missing" });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    if (error || !user)
      return res.status(400).json({ error: "Failed to fetch user" });

    const { email, user_metadata } = user;
    const name = user_metadata?.name || user_metadata?.full_name || "User";

    const { data: existing } = await dbClient
      .from("Users")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (!existing || !existing.length) {
      await dbClient
        .from("Users")
        .insert([{ name, email, provider: user.app_metadata.provider || "oauth" }]);
    }

    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Social callback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
