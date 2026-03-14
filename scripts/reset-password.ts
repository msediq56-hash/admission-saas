import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
async function main() {
  const { data } = await supabase.auth.admin.listUsers();
  const user = data?.users?.find(u => u.email === 'm.sediq56@gmail.com');
  if (!user) { console.log('User not found!'); return; }
  console.log('User found:', user.id);
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: 'Test1234' });
  if (error) { console.log('Error:', error.message); return; }
  console.log('Password changed to: Test1234');
}
main();
