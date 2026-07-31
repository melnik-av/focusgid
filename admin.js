import { supabase } from './supabase-config.js';

let currentTab = 'walks';

// Переключение вкладок
window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    if (tab === 'walks') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('walksTab').classList.add('active');
        loadWalks();
    } else {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('tracksTab').classList.add('active');
        loadTracks();
    }
};

// Авторизация
window.login = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.textContent = '❌ ' + error.message;
    }
};

window.logout = async () => {
    await supabase.auth.signOut();
};

supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('userEmail').textContent = session.user.email;
        loadWalks();
    } else {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
    }
});

// Загрузка аудиотреков
async function loadTracks() {
    const { data: tracks, error } = await supabase
        .from('audio_tracks')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Ошибка загрузки треков:', error);
        return;
    }
    
    const list = document.getElementById('tracksList');
    if (!tracks || tracks.length === 0) {
        list.innerHTML = '<div style="color: #999999; text-align: center; padding: 40px;">Нет загруженных треков</div>';
        return;
    }
    
    list.innerHTML = tracks.map(track => {
        const duration = formatDuration(track.duration);
        return '<div class="item-card">' +
            '<div class="item-header">' +
                '<h3 class="item-title">' + track.title + '</h3>' +
            '</div>' +
            '<div class="item-meta">' + (duration || 'Длительность не определена') + '</div>' +
            '<div class="item-actions">' +
                '<button class="btn btn-danger" onclick="deleteTrack(\'' + track.id + '\')">Удалить</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// Загрузка прогулок
async function loadWalks() {
    const { data: walks, error } = await supabase
        .from('walks')
        .select('*, audio_tracks(title)')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Ошибка загрузки прогулок:', error);
        return;
    }
    
    const list = document.getElementById('walksList');
    if (!walks || walks.length === 0) {
        list.innerHTML = '<div style="color: #999999; text-align: center; padding: 40px;">Нет прогулок</div>';
        return;
    }
    
    list.innerHTML = walks.map(walk => {
        const trackTitle = walk.audio_tracks ? walk.audio_tracks.title : 'Без трека';
        return '<div class="item-card">' +
            '<div class="item-header">' +
                '<h3 class="item-title">' + walk.title + '</h3>' +
            '</div>' +
            (walk.description ? '<div class="item-description">' + walk.description + '</div>' : '') +
            '<div class="item-meta"> ' + trackTitle + '</div>' +
            '<div class="item-actions">' +
                '<button class="btn" onclick="editWalk(\'' + walk.id + '\')">Редактировать</button>' +
                '<button class="btn btn-danger" onclick="deleteWalk(\'' + walk.id + '\')">Удалить</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// Открытие модалки прогулки
window.openWalkModal = async () => {
    document.getElementById('walkModal').classList.add('active');
    document.getElementById('walkTitle').value = '';
    document.getElementById('walkDescription').value = '';
    
    // Загружаем список треков для выбора
    const { data: tracks } = await supabase
        .from('audio_tracks')
        .select('id, title')
        .order('title');
    
    const select = document.getElementById('walkTrack');
    select.innerHTML = '<option value="">Без трека</option>';
    if (tracks) {
        tracks.forEach(track => {
            select.innerHTML += '<option value="' + track.id + '">' + track.title + '</option>';
        });
    }
};

window.closeWalkModal = () => {
    document.getElementById('walkModal').classList.remove('active');
};

// Сохранение прогулки
window.saveWalk = async () => {
    const title = document.getElementById('walkTitle').value.trim();
    const description = document.getElementById('walkDescription').value.trim();
    const trackId = document.getElementById('walkTrack').value || null;
    
    if (!title) {
        alert('Введите название прогулки');
        return;
    }
    
    const { error } = await supabase
        .from('walks')
        .insert({
            title,
            description: description || null,
            audio_track_id: trackId
        });
    
    if (error) {
        alert('Ошибка: ' + error.message);
    } else {
        closeWalkModal();
        loadWalks();
    }
};

// Открытие модалки трека
window.openTrackModal = () => {
    document.getElementById('trackModal').classList.add('active');
    document.getElementById('trackTitle').value = '';
    document.getElementById('trackFile').value = '';
};

window.closeTrackModal = () => {
    document.getElementById('trackModal').classList.remove('active');
};

// Сохранение трека
window.saveTrack = async () => {
    const title = document.getElementById('trackTitle').value.trim();
    const file = document.getElementById('trackFile').files[0];
    
    if (!title || !file) {
        alert('Заполните название и выберите файл');
        return;
    }
    
    try {
        // Загрузка файла
        const fileName = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
        
        const { error: uploadError } = await supabase.storage
            .from('tracks')
            .upload(fileName, file, { cacheControl: '3600', upsert: false });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
            .from('tracks')
            .getPublicUrl(fileName);
        
        // Определение длительности
        const audio = new Audio(publicUrl);
        const duration = await new Promise((resolve) => {
            audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
            audio.addEventListener('error', () => resolve(0));
        });
        
        // Создание записи
        const { error } = await supabase
            .from('audio_tracks')
            .insert({
                title,
                file_url: publicUrl,
                duration: duration > 0 ? Math.round(duration) : null
            });
        
        if (error) throw error;
        
        closeTrackModal();
        loadTracks();
        
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
};

// Удаление трека
window.deleteTrack = async (id) => {
    if (!confirm('Удалить этот трек?')) return;
    
    const { error } = await supabase
        .from('audio_tracks')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert('Ошибка: ' + error.message);
    } else {
        loadTracks();
    }
};

// Удаление прогулки
window.deleteWalk = async (id) => {
    if (!confirm('Удалить эту прогулку?')) return;
    
    const { error } = await supabase
        .from('walks')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert('Ошибка: ' + error.message);
    } else {
        loadWalks();
    }
};

// Редактирование прогулки (заглушка)
window.editWalk = (id) => {
    alert('Функция редактирования будет добавлена позже');
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return hours + ':' + mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
    } else {
        return mins + ':' + secs.toString().padStart(2, '0');
    }
}
