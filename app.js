async function loadTrack() {
    try {
        console.log('Подключение к Supabase...');
        statusEl.textContent = 'Подключение к Supabase...';
        
        // Правильный запрос к Supabase
        const { data, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('active', true)
            .limit(1)
            .single();  // Получаем одну запись

        if (error) {
            console.error('Ошибка базы данных:', error);
            statusEl.textContent = `❌ Ошибка БД: ${error.message}`;
            return;
        }

        if (!data) {
            console.log('Нет активных треков');
            statusEl.textContent = ' Нет доступных треков';
            return;
        }

        const track = data;
        console.log('Найден трек:', track);
        titleEl.textContent = track.title || 'Аудиопрогулка';
        
        if (!track.file_url) {
            console.error('Нет URL файла в базе');
            statusEl.textContent = '❌ Ошибка: нет ссылки на файл';
            return;
        }
        
        console.log('URL файла:', track.file_url);
        statusEl.textContent = '⏳ Скачивание трека...';
        await cacheAndPlay(track.file_url);
        
    } catch (error) {
        console.error('Критическая ошибка:', error);
        statusEl.textContent = `❌ Ошибка: ${error.message}`;
    }
}
