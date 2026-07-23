import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ
const SUPABASE_URL = 'https://hpisnwhoqzjkcmmlkmys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwaXNud2hvcXpqa2NtbWxrbXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTU5ODIsImV4cCI6MjEwMDI5MTk4Mn0.qDsx5Hx7OioDSNSYIuyXkM7KAraBYV0cluOHciGRwY8'; // ВСТАВЬТЕ ВАШ КЛЮЧ

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ ОШИБКА: Не указаны SUPABASE_URL или SUPABASE_ANON_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase клиент создан');
console.log('URL:', SUPABASE_URL);

export { supabase };
