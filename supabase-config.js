
// Import Supabase SDK
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ ИЗ SUPABASE
// Settings → API → Project URL
const SUPABASE_URL = 'https://hpisnwhoqzjkcmmlkmys.supabase.co/rest/v1';

// Settings → API → anon public
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwaXNud2hvcXpqa2NtbWxrbXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTU5ODIsImV4cCI6MjEwMDI5MTk4Mn0.qDsx5Hx7OioDSNSYIuyXkM7KAraBYV0cluOHciGRwY8';

// Проверка что данные введены
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_URL или SUPABASE_ANON_KEY не указаны!');
    alert('Ошибка конфигурации Supabase');
}

// Создание клиента с правильными заголовками
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    global: {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    }
});

console.log('✅ Supabase клиент создан');
console.log('URL:', SUPABASE_URL);
console.log('API Key:', SUPABASE_ANON_KEY ? 'OK' : 'MISSING');

export { supabase };
