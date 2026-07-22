// Подключение Supabase SDK через CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ ИЗ ШАГА 5
const SUPABASE_URL = 'https://hpisnwhoqzjkcmmlkmys.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwaXNud2hvcXpqa2NtbWxrbXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTU5ODIsImV4cCI6MjEwMDI5MTk4Mn0.qDsx5Hx7OioDSNSYIuyXkM7KAraBYV0cluOHciGRwY8';

// Инициализация клиента
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Экспорт для использования в других файлах
export { supabase };
