const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sfzforiylmhxlckvhtjy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmemZvcml5bG1oeGxja3ZodGp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ1MzQwNSwiZXhwIjoyMDkzMDI5NDA1fQ.etxgZCfEvxORKqd9CXIL4vocmK_EUkU8fVxkPwEVcMc';

async function createTestAdmin() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const password = 'TestAdmin123!';
  const hash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: 'admin@stacruz.gov.ph',
      password_hash: hash,
      first_name: 'Test',
      last_name: 'Admin',
      role: 'Admin',
      status: 'Active',
      chain_role_granted: false,
    });

  if (error) {
    console.error('Error creating test admin:', error.message);
    return;
  }

  console.log('✅ Test Admin Created Successfully!');
  console.log('Email: admin@stacruz.gov.ph');
  console.log('Password: ' + password);
  console.log('User ID: ' + userId);
}

createTestAdmin();
