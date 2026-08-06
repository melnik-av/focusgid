async function loadWalkData(walkId, role) {
    console.log('📥 Загрузка прогулки:', walkId, 'role:', role);
    
    // Сначала загружаем прогулку без связей
    const { data: walk, error } = await supabase
        .from('walks')
        .select('*')
        .eq('id', walkId)
        .single();
    
    if (error) {
        console.error('❌ Ошибка загрузки прогулки:', error);
        throw new Error('Прогулка не найдена или недоступна');
    }
    
    console.log('✅ Прогулка загружена:', walk);
    console.log(' Все поля прогулки:', Object.keys(walk));
    console.log('🔑 audio_track_id:', walk.audio_track_id);
    console.log(' audio_track_id_2:', walk.audio_track_id_2);
    console.log(' type:', walk.type);
    
    // Теперь загружаем треки отдельно
    let track1 = null;
    let track2 = null;
    
    if (walk.audio_track_id) {
        const { data: t1 } = await supabase
            .from('audio_tracks')
            .select('*')
            .eq('id', walk.audio_track_id)
            .single();
        track1 = t1;
        console.log('🎵 Трек 1 (audio_track_id):', track1);
    }
    
    if (walk.audio_track_id_2) {
        const { data: t2 } = await supabase
            .from('audio_tracks')
            .select('*')
            .eq('id', walk.audio_track_id_2)
            .single();
        track2 = t2;
        console.log(' Трек 2 (audio_track_id_2):', track2);
    }
    
    // Выбираем нужный трек
    let track = null;
    if (walk.type === 'pair' && role) {
        if (role === 'male') {
            track = track2;
            console.log('🎧 Выбран мужской трек:', track);
        } else {
            track = track1;
            console.log(' Выбран женский трек:', track);
        }
    } else {
        track = track1;
        console.log('🎧 Выбран трек:', track);
    }
    
    if (!track) {
        console.error('❌ Трек не найден');
        throw new Error('Аудиотрек не найден. Проверьте, что прогулке назначен трек в админке.');
    }
    
    if (!track.file_url) {
        console.error('❌ У трека нет file_url:', track);
        throw new Error('У аудиотрека отсутствует файл.');
    }
    
    console.log('✅ Трек найден:', track.title, track.file_url);
    
    // Добавляем треки в объект walk для совместимости
    walk.audio_tracks = track1;
    walk.audio_tracks_2 = track2;
    
    return { walk, track };
}
