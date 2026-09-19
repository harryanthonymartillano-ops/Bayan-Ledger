const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sfzforiylmhxlckvhtjy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmemZvcml5bG1oeGxja3ZodGp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ1MzQwNSwiZXhwIjoyMDkzMDI5NDA1fQ.etxgZCfEvxORKqd9CXIL4vocmK_EUkU8fVxkPwEVcMc';

async function resetAdminPassword() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const newPassword = 'Admin12345!';
  const hash = await bcrypt.hash(newPassword, 12);
  
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('email', 'admin@stacruz.gov.ph');

  if (error) {
    console.error('Error resetting admin password:', error.message);
    return;
  }

  console.log('✅ Admin Password Reset Successfully!');
  console.log('Email: admin@stacruz.gov.ph');
  console.log('Password: ' + newPassword);
}

resetAdminPassword();
