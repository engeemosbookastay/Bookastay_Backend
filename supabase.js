import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Key must be provided in .env file");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const connectSupabase = async () => {
  try {
    const { error: userError } = await supabase.from("User").select("id").limit(1);
    if (userError) throw new Error(`User table error: ${userError.message}`);
    console.log("Connected to User table successfully");

    const { error: contactError } = await supabase.from("Contact").select("id").limit(1);
    if (contactError) throw new Error(`Contact table error: ${contactError.message}`);
    console.log("Connected to Contact table successfully");

    const { error: bookingError } = await supabase.from("Bookings").select("id").limit(1);
    if (bookingError) throw new Error(`Bookings table error: ${bookingError.message}`);
    console.log("Connected to Bookings table successfully");

    console.log("Supabase connection check completed successfully");
  } catch (err) {
    console.error("Supabase connection failed:", err.message);
    process.exit(1);
  }
};

export { supabase, connectSupabase };
