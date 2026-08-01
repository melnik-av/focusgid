import { supabase } from './supabase-config.js';

let currentTab = 'walks';
let selectedCoverFile = null;
let selectedCoverUrl = null;
let editingWalkId = null;
let editingTrackId = null;

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    if (tab === 'walks') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('walksTab').classList.add('active');
        loadWalks();
    } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('tracksTab').classList.add('active');
        loadTracks();
    }
};

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

function renderCoverPreview(imageUrl, showDelete) {
    const container = document.getElementById('walkCoverPreview');
    if (showDelete && imageUrl) {
        container.innerHTML = 
            '<img src="' + imageUrl + '" alt="Обложка">' +
            '<button class="cover-delete-btn" onclick="event.stopPropagation(); removeWalkCover()" title="Удалить обложку">🗑</button>';
    } else {
        container.innerHTML = 
            '<div class="cover-preview-placeholder">' +
                '<span class="cover-icon">+</span>' +
                'Нажмите чтобы добавить обложку' +
            '</div>';
    }
}

window.removeWalkCover = () => {
    selectedCoverFile = null;
    selectedCoverUrl = null;
    document.getElementById('walkCoverFile').value = '';
    renderCoverPreview(null, false);
};

document.getElementById('walkCoverFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedCoverFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedCoverUrl = e.target.result;
            renderCoverPreview(e.target.result, true);
        };
        reader.readAsDataURL(file);
    }
});

function closeAllWalkMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
    });
}

function closeAllTrackMenus() {
    document.querySelectorAll('.track-dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
    });
}

function closeAllMenus() {
    closeAllWalkMenus();
    closeAllTrackMenus();
    const overlay = document.getElementById('menuOverlay');
    if (overlay) overlay.classList.remove('active');
}

window.toggleWalkMenu = (id) => {
    const menu = document.getElementById('walk-menu-' + id);
    const overlay = document.getElementById('menuOverlay');
    
    if (menu.classList.contains('active')) {
        closeAllMenus();
        return;
    }
    
    closeAllMenus();
    
    menu.classList.add('active');
    if (overlay) overlay.classList.add('active');
};

window.toggleTrackMenu = (id) => {
    const menu = document.getElementById('track-menu-' + id);
    const overlay = document.getElementById('menuOverlay');
    
    if (menu.classList.contains('active')) {
        closeAllMenus();
        return;
    }
    
    closeAllMenus();
    
    menu.classList.add('active');
    if (overlay) overlay.classList.add('active');
};

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('menuOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeAllMenus);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllMenus();
    }
});

window.copyWalkLink = async (link, title) => {
    closeAllMenus();
    try {
        await navigator.clipboard.writeText(link);
        alert('✅ Ссылка на "' + title + '" скопирована!');
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Ссылка скопирована!');
    }
};

async function loadTracks() {
    closeAllMenus();
    
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
    
    const dotsIcon = '<svg width="16" height="4" viewBox="0 0 16 4"><circle cx="2" cy="2" r="2" fill="#666666"/><circle cx="8" cy="2" r="2" fill="#666666"/><circle cx="14" cy="2" r="2" fill="#666666"/></svg>';
    
    list.innerHTML = tracks.map(track => {
        const duration = formatDuration(track.duration);
        const durationText = duration ? ' · ' + duration : '';
        
        return '<div class="item-card" id="track-' + track.id + '">' +
            '<div class="item-header" style="align-items: center;">' +
                '<div class="item-info">' +
                    '<h3 class="item-title" style="margin: 0;">' + track.title + '<span style="font-weight: 400; color: #999999;">' + durationText + '</span></h3>' +
                '</div>' +
                '<button class="track-menu-button" onclick="toggleTrackMenu(\'' + track.id + '\')" title="Меню">' + dotsIcon + '</button>' +
            '</div>' +
            
            '<div class="track-dropdown-menu" id="track-menu-' + track.id + '">' +
                '<button class="track-dropdown-item" onclick="editTrack(\'' + track.id + '\', \'' + track.title.replace(/'/g, "\\'") + '\')">' +
                    '<span>✏️</span> Редактировать' +
                '</button>' +
                '<button class="track-dropdown-item danger" onclick="deleteTrack(\'' + track.id + '\')">' +
                    '<span>🗑</span> Удалить' +
                '</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

window.editTrack = (id, title) => {
    closeAllMenus();
    editingTrackId = id;
    document.getElementById('editTrackTitle').value = title;
    document.getElementById('editTrackModal').classList.add('active');
};

window.closeEditTrackModal = () => {
    document.getElementById('editTrackModal').classList.remove('active');
    editingTrackId = null;
};

window.saveTrackName = async () => {
    const title = document.getElementById('editTrackTitle').value.trim();
    
    if (!title) {
        alert('Введите название трека');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('audio_tracks')
            .update({ title })
            .eq('id', editingTrackId);
        
        if (error) throw error;
        
        closeEditTrackModal();
        loadTracks();
        
    } catch (e) {
        alert('Ошибка: ' + e.message);
        console.error(e);
    }
};

async function loadWalks() {
    closeAllMenus();
    
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
    
    const playerUrl = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
    
    const dotsIcon = '<svg width="20" height="4" viewBox="0 0 20 4"><circle cx="2" cy="2" r="2" fill="#1a1a1a"/><circle cx="10" cy="2" r="2" fill="#1a1a1a"/><circle cx="18" cy="2" r="2" fill="#1a1a1a"/></svg>';
    
    list.innerHTML = walks.map(walk => {
        const trackTitle = walk.audio_tracks ? walk.audio_tracks.title : 'Без трека';
        const coverHtml = walk.cover_url 
            ? '<img src="' + walk.cover_url + '" alt="' + walk.title + '">'
            : '<div class="item-cover-placeholder">🚶</div>';
        
        const walkLink = playerUrl + '?track=' + walk.id;
        
        return '<div class="item-card" id="walk-' + walk.id + '">' +
            '<div class="item-header">' +
                '<div class="item-cover">' + coverHtml + '</div>' +
                '<div class="item-info">' +
                    '<h3 class="item-title">' + walk.title + '</h3>' +
                    (walk.description ? '<div class="item-description">' + walk.description + '</div>' : '') +
                    '<div class="item-meta">🎵 ' + trackTitle + '</div>' +
                '</div>' +
                '<button class="menu-button" onclick="toggleWalkMenu(\'' + walk.id + '\')" title="Меню">' + dotsIcon + '</button>' +
            '</div>' +
            
            '<div class="dropdown-menu" id="walk-menu-' + walk.id + '">' +
                '<button class="dropdown-item" onclick="copyWalkLink(\'' + walkLink + '\', \'' + walk.title.replace(/'/g, "\\'") + '\')">' +
                    '<span class="dropdown-icon">🔗</span> Копировать ссылку' +
                '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button class="dropdown-item" onclick="editWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">✏️</span> Редактировать' +
                '</button>' +
                '<button class="dropdown-item danger" onclick="deleteWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">🗑</span> Удалить' +
                '</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

window.openWalkModal = async () => {
    editingWalkId = null;
    document.getElementById('walkModalTitle').textContent = 'Добавить прогулку';
    document.getElementById('walkTitle').value = '';
    document.getElementById('walkDescription').value = '';
    selectedCoverFile = null;
    selectedCoverUrl = null;
    document.getElementById('walkCoverFile').value = '';
    renderCoverPreview(null, false);
    
    await loadTracksToSelect();
    
    document.getElementById('walkModal').classList.add('active');
};

window.closeWalkModal = () => {
    document.getElementById('walkModal').classList.remove('active');
    editingWalkId = null;
};

async function loadTracksToSelect() {
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
}

window.saveWalk = async () => {
    const title = document.getElementById('walkTitle').value.trim();
    const description = document.getElementById('walkDescription').value.trim();
    const trackId = document.getElementById('walkTrack').value || null;
    
    if (!title) {
        alert('Введите название прогулки');
        return;
    }
    
    try {
        let coverUrl = null;
        
        if (selectedCoverFile) {
            const coverFileName = 'cover_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.jpg';
            const { error: uploadError } = await supabase.storage
                .from('covers')
                .upload(coverFileName, selectedCoverFile, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
                .from('covers')
                .getPublicUrl(coverFileName);
            
            coverUrl = publicUrl;
        }
        
        const walkData = {
            title,
            description: description || null,
            audio_track_id: trackId
        };
        
        if (coverUrl) {
            walkData.cover_url = coverUrl;
        }
        
        if (editingWalkId) {
            const { error } = await supabase
                .from('walks')
                .update(walkData)
                .eq('id', editingWalkId);
            
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('walks')
                .insert(walkData);
            
            if (error) throw error;
        }
        
        closeWalkModal();
        loadWalks();
        
    } catch (e) {
        alert('Ошибка: ' + e.message);
        console.error(e);
    }
};

window.editWalk = async (id) => {
    closeAllMenus();
    
    const { data: walk, error } = await supabase
        .from('walks')
        .select('*, audio_tracks(title)')
        .eq('id', id)
        .single();
    
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    
    editingWalkId = id;
    document.getElementById('walkModalTitle').textContent = 'Редактировать прогулку';
    document.getElementById('walkTitle').value = walk.title || '';
    document.getElementById('walkDescription').value = walk.description || '';
    
    await loadTracksToSelect();
    
    if (walk.audio_track_id) {
        document.getElementById('walkTrack').value = walk.audio_track_id;
    }
    
    if (walk.cover_url) {
        selectedCoverFile = null;
        selectedCoverUrl = walk.cover_url;
        renderCoverPreview(walk.cover_url, true);
    } else {
        selectedCoverFile = null;
        selectedCoverUrl = null;
        renderCoverPreview(null, false);
    }
    
    document.getElementById('walkModal').classList.add('active');
};

window.deleteWalk = async (id) => {
    closeAllMenus();
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

window.openTrackModal = () => {
    document.getElementById('trackModal').classList.add('active');
    document.getElementById('trackTitle').value = '';
    document.getElementById('trackFile').value = '';
    
    // Сброс спиннера
    document.getElementById('uploadForm').classList.remove('hidden');
    document.getElementById('uploadSpinner').classList.remove('active');
    document.getElementById('trackModalFooter').style.display = 'flex';
    document.getElementById('saveTrackBtn').disabled = false;
};

window.closeTrackModal = () => {
    document.getElementById('trackModal').classList.remove('active');
    
    // Сброс спиннера
    document.getElementById('uploadForm').classList.remove('hidden');
    document.getElementById('uploadSpinner').classList.remove('active');
    document.getElementById('trackModalFooter').style.display = 'flex';
    document.getElementById('saveTrackBtn').disabled = false;
};

window.saveTrack = async () => {
    const title = document.getElementById('trackTitle').value.trim();
    const file = document.getElementById('trackFile').files[0];
    
    if (!title || !file) {
        alert('Заполните название и выберите файл');
        return;
    }
    
    // Показываем спиннер
    document.getElementById('uploadForm').classList.add('hidden');
    document.getElementById('uploadSpinner').classList.add('active');
    document.getElementById('trackModalFooter').style.display = 'none';
    
    try {
        document.getElementById('spinnerText').textContent = '⏳ Загрузка файла...';
        
        const fileName = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
        
        const { error: uploadError } = await supabase.storage
            .from('tracks')
            .upload(fileName, file, { cacheControl: '3600', upsert: false });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
            .from('tracks')
            .getPublicUrl(fileName);
        
        document.getElementById('spinnerText').textContent = '⏱️ Определение длительности...';
        
        // Определение длительности (неблокирующее)
        let duration = null;
        try {
            const audio = new Audio(publicUrl);
            audio.preload = 'metadata';
            
            duration = await new Promise((resolve) => {
                let resolved = false;
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve(null);
                    }
                }, 5000);
                
                audio.addEventListener('loadedmetadata', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(audio.duration);
                    }
                });
                
                audio.addEventListener('error', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(null);
                    }
                });
                
                audio.src = publicUrl + '?t=' + Date.now();
            });
        } catch (e) {
            console.warn('Не удалось определить длительность:', e);
            duration = null;
        }
        
        document.getElementById('spinnerText').textContent = '💾 Сохранение в базе...';
        
        const { error } = await supabase
            .from('audio_tracks')
            .insert({
                title,
                file_url: publicUrl,
                duration: duration ? Math.round(duration) : null
            });
        
        if (error) throw error;
        
        document.getElementById('spinnerText').textContent = '✅ Трек загружен!';
        
        setTimeout(() => {
            closeTrackModal();
            loadTracks();
        }, 1000);
        
    } catch (e) {
        console.error('Ошибка загрузки трека:', e);
        document.getElementById('spinnerText').textContent = '❌ Ошибка: ' + e.message;
        document.getElementById('spinnerText').style.color = '#e94560';
        
        setTimeout(() => {
            document.getElementById('uploadForm').classList.remove('hidden');
            document.getElementById('uploadSpinner').classList.remove('active');
            document.getElementById('trackModalFooter').style.display = 'flex';
            document.getElementById('spinnerText').style.color = '#666666';
        }, 2000);
    }
};

window.deleteTrack = async (id) => {
    closeAllMenus();
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
