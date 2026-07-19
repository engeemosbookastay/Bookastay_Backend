import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../services/supabase.js';

const EMAIL    = 'engeemosbookastay@gmail.com';
const PASSWORD = 'BookAStay@2024';
const NAME     = 'Engeemos Admin';

const hash = await bcrypt.hash(PASSWORD, 10);

const { data, error } = await supabaseAdmin
  .from('admins')
  .upsert([{ email: EMAIL, password: hash, name: NAME }], { onConflict: 'email' })
  .select('id, email, name, created_at')
  .single();

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

console.log('Admin created successfully:');
console.log('  Email:   ', EMAIL);
console.log('  Password:', PASSWORD);
console.log('  ID:      ', data.id);
process.exit(0);
