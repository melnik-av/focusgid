import { supabase } from './supabase-config.js';

let currentTab = 'walks';
let selectedCoverFile = null;
let selectedCoverUrl = null;
let editingWalkId = null;
let editingTrackId = null;
let currentUserRole = null;
let currentAdminId = null;
let editingUserId = null;
let currentPlayingAudio = null;
let currentPlayingTrackId = null;
let trackProgressInterval = null;

const SUPABASE_URL = supabase.supabaseUrl;
const SUPABASE_ANON_KEY = supabase.supabaseKey;

// === ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ===

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    const tabs = document.querySelectorAll('.tab');
    
    if (tab === 'walks') {
        tabs[0].classList.add('active');
        document.getElementById('walksTab').classList.add('active');
        loadWalks();
    } else if (tab === 'tracks') {
        tabs[1].classList.add('active');
        document.getElementById('tracksTab').classList.add('active');
        loadTracks();
    } else if (tab === 'users') {
        tabs[2].classList.add('active');
        document.getElementById('usersTab').classList.add('active');
        loadUsers();
    }
};

// === АВТОРИЗАЦИЯ ===

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

supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('email', session.user.email)
            .single();
        
        if (error || !admin) {
            await supabase.auth.signOut();
            document.getElementById('loginError').textContent = '❌ У вас нет доступа к админке';
            return;
        }
        
        currentUserRole = admin.role;
        currentAdminId = admin.id;
        
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        
        const roleLabel = admin.role === 'super_admin' ? 'Супер-админ' : 'Админ';
        document.getElementById('userEmail').textContent = session.user.email + ' (' + roleLabel + ')';
        
        const usersTabBtn = document.getElementById('usersTabBtn');
        if (currentUserRole === 'super_admin') {
            usersTabBtn.style.display = 'block';
        } else {
            usersTabBtn.style.display = 'none';
        }
        
        loadWalks();
    } else {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        currentUserRole = null;
        currentAdminId = null;
    }
});

// === ОБЛОЖКА ===

function renderCoverPreview(imageUrl, showDelete) {
    const container = document.getElementById('walkCoverPreview');
    if (showDelete && imageUrl) {
        container.innerHTML = 
            '<img src="' + imageUrl + '" alt="Обложка">' +
            '<button class="cover-delete-btn" onclick="event.stopPropagation(); removeWalkCover()" title="Удалить обложку"></button>';
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

// === ТИП ПРОГУЛКИ ===

window.onWalkTypeChange = () => {
    const type = document.querySelector('input[name="walkType"]:checked').value;
    const singleField = document.getElementById('singleTrackField');
    const pairField = document.getElementById('pairTracks');
    
    if (type === 'pair') {
        singleField.classList.add('hidden');
        pairField.classList.add('active');
    } else {
        singleField.classList.remove('hidden');
        pairField.classList.remove('active');
    }
};

function getSelectedWalkType() {
    return document.querySelector('input[name="walkType"]:checked').value;
}

function setWalkType(type) {
    const radio = document.getElementById('type' + type.charAt(0).toUpperCase() + type.slice(1));
    if (radio) {
        radio.checked = true;
        onWalkTypeChange();
    }
}

// === МЕНЮ ===

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

function closeAllUserMenus() {
    document.querySelectorAll('.track-dropdown-menu').forEach(menu => {
        if (menu.id && menu.id.startsWith('user-menu-')) {
            menu.classList.remove('active');
        }
    });
}

function closeAllMenus() {
    closeAllWalkMenus();
    closeAllTrackMenus();
    closeAllUserMenus();
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

window.toggleUserMenu = (id) => {
    const menu = document.getElementById('user-menu-' + id);
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
        alert('✅ Ссылка "' + title + '" скопирована!');
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

// === АУДИОТРЕКИ ===

const playIcon = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 2 L10 6 L3 10 Z" fill="white"/></svg>';
const pauseIcon = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="2" width="2" height="8" fill="white"/><rect x="7" y="2" width="2" height="8" fill="white"/></svg>';

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
        const durationText = duration || '0:00';
        
        return '<div class="item-card" id="track-' + track.id + '">' +
            '<div class="item-header" style="align-items: center;">' +
                '<div class="track-play-wrapper">' +
                    '<button class="track-play-btn" id="play-btn-' + track.id + '" onclick="toggleTrackPreview(\'' + track.id + '\', \'' + track.file_url.replace(/'/g, "\\'") + '\')" title="Прослушать">' +
                        playIcon +
                    '</button>' +
                    '<div class="item-info">' +
                        '<h3 class="item-title" style="margin: 0;">' + track.title + '<span style="font-weight: 400; color: #999999;"> · ' + durationText + '</span></h3>' +
                        '<div class="track-progress-container" id="progress-container-' + track.id + '">' +
                            '<div class="track-progress-bar" id="progress-bar-' + track.id + '">' +
                                '<div class="track-progress-fill" id="progress-fill-' + track.id + '"></div>' +
                            '</div>' +
                            '<div class="track-progress-time">' +
                                '<span id="current-time-' + track.id + '">0:00</span> / <span>' + durationText + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
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

window.toggleTrackPreview = async (trackId, fileUrl) => {
    const playBtn = document.getElementById('play-btn-' + trackId);
    
    if (currentPlayingTrackId === trackId && currentPlayingAudio) {
        stopTrackPreview();
        return;
    }
    
    stopTrackPreview();
    
    try {
        currentPlayingAudio = new Audio(fileUrl + '?t=' + Date.now());
        currentPlayingTrackId = trackId;
        
        playBtn.innerHTML = pauseIcon;
        playBtn.classList.add('playing');
        
        await currentPlayingAudio.play();
        
        trackProgressInterval = setInterval(() => {
            updateTrackProgress(trackId);
        }, 100);
        
        currentPlayingAudio.addEventListener('ended', () => {
            stopTrackPreview();
        });
        
        currentPlayingAudio.addEventListener('error', (e) => {
            console.error('Ошибка воспроизведения:', e);
            stopTrackPreview();
        });
        
        const progressBar = document.getElementById('progress-bar-' + trackId);
        progressBar.addEventListener('click', (e) => {
            seekTrack(e, trackId);
        });
        
    } catch (error) {
        console.error('Ошибка запуска воспроизведения:', error);
        stopTrackPreview();
    }
};

function updateTrackProgress(trackId) {
    if (!currentPlayingAudio || !currentPlayingAudio.duration) return;
    
    const currentTime = currentPlayingAudio.currentTime;
    const duration = currentPlayingAudio.duration;
    const progress = (currentTime / duration) * 100;
    
    const fill = document.getElementById('progress-fill-' + trackId);
    const timeDisplay = document.getElementById('current-time-' + trackId);
    
    if (fill) fill.style.width = progress + '%';
    if (timeDisplay) timeDisplay.textContent = formatDuration(currentTime);
}

function seekTrack(event, trackId) {
    if (!currentPlayingAudio || currentPlayingTrackId !== trackId) return;
    
    const progressBar = document.getElementById('progress-bar-' + trackId);
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const percent = Math.max(0, Math.min(1, clickX / width));
    
    currentPlayingAudio.currentTime = percent * currentPlayingAudio.duration;
    updateTrackProgress(trackId);
}

function stopTrackPreview() {
    if (trackProgressInterval) {
        clearInterval(trackProgressInterval);
        trackProgressInterval = null;
    }
    
    if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.src = '';
        currentPlayingAudio = null;
    }
    
    if (currentPlayingTrackId) {
        const playBtn = document.getElementById('play-btn-' + currentPlayingTrackId);
        const fill = document.getElementById('progress-fill-' + currentPlayingTrackId);
        const timeDisplay = document.getElementById('current-time-' + currentPlayingTrackId);
        
        if (playBtn) {
            playBtn.innerHTML = playIcon;
            playBtn.classList.remove('playing');
        }
        if (fill) fill.style.width = '0%';
        if (timeDisplay) timeDisplay.textContent = '0:00';
        
        currentPlayingTrackId = null;
    }
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

window.openTrackModal = () => {
    document.getElementById('trackModal').classList.add('active');
    document.getElementById('trackTitle').value = '';
    document.getElementById('trackFile').value = '';
    
    document.getElementById('uploadForm').classList.remove('hidden');
    document.getElementById('uploadSpinner').classList.remove('active');
    document.getElementById('trackModalFooter').style.display = 'flex';
    document.getElementById('saveTrackBtn').disabled = false;
};

window.closeTrackModal = () => {
    document.getElementById('trackModal').classList.remove('active');
    
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

// === ПРОГУЛКИ ===

async function loadWalks() {
    closeAllMenus();
    
    const { data: walks, error } = await supabase
        .from('walks')
        .select('*, audio_tracks!audio_track_id(title), audio_tracks_2:audio_tracks!audio_track_id_2(title)')
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
    
    const dotsIcon = '<svg width="16" height="4" viewBox="0 0 16 4"><circle cx="2" cy="2" r="2" fill="#666666"/><circle cx="8" cy="2" r="2" fill="#666666"/><circle cx="14" cy="2" r="2" fill="#666666"/></svg>';
    
    const typeLabels = {
        'solo': { text: 'Соло', class: 'type-solo' },
        'pair': { text: 'Парная', class: 'type-pair' },
        'group': { text: 'Групповая', class: 'type-group' }
    };
    
    list.innerHTML = walks.map(walk => {
        const walkType = walk.type || 'solo';
        const typeInfo = typeLabels[walkType] || typeLabels['solo'];
        const coverHtml = walk.cover_url 
            ? '<img src="' + walk.cover_url + '" alt="' + walk.title + '">'
            : '<div class="item-cover-placeholder"></div>';
        
        const walkLink = playerUrl + '?walk=' + walk.id;
        
        let tracksInfo = '';
        let menuItems = '';
        
        if (walkType === 'pair') {
            const femaleTrack = walk.audio_tracks ? walk.audio_tracks.title : 'не выбран';
            const maleTrack = walk.audio_tracks_2 ? walk.audio_tracks_2.title : 'не выбран';
            tracksInfo = '👩 ' + femaleTrack + ' · 👨 ' + maleTrack;
            
            const femaleLink = playerUrl + '?walk=' + walk.id + '&role=female';
            const maleLink = playerUrl + '?walk=' + walk.id + '&role=male';
            
            menuItems = 
                '<button class="dropdown-item" onclick="copyWalkLink(\'' + femaleLink + '\', \'' + walk.title.replace(/'/g, "\\'") + ' (она)\')">' +
                    '<span class="dropdown-icon"></span> Ссылка для неё' +
                '</button>' +
                '<button class="dropdown-item" onclick="copyWalkLink(\'' + maleLink + '\', \'' + walk.title.replace(/'/g, "\\'") + ' (он)\')">' +
                    '<span class="dropdown-icon">👨</span> Ссылка для него' +
                '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button class="dropdown-item" onclick="editWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">️</span> Редактировать' +
                '</button>' +
                '<button class="dropdown-item danger" onclick="deleteWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">🗑</span> Удалить' +
                '</button>';
        } else {
            const trackTitle = walk.audio_tracks ? walk.audio_tracks.title : 'Без трека';
            tracksInfo = '🎵 ' + trackTitle;
            
            menuItems = 
                '<button class="dropdown-item" onclick="copyWalkLink(\'' + walkLink + '\', \'' + walk.title.replace(/'/g, "\\'") + '\')">' +
                    '<span class="dropdown-icon">🔗</span> Копировать ссылку' +
                '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button class="dropdown-item" onclick="editWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">✏️</span> Редактировать' +
                '</button>' +
                '<button class="dropdown-item danger" onclick="deleteWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">🗑</span> Удалить' +
                '</button>';
        }
        
        return '<div class="item-card" id="walk-' + walk.id + '">' +
            '<div class="item-header">' +
                '<div class="item-cover">' + coverHtml + '</div>' +
                '<div class="item-info">' +
                    '<h3 class="item-title">' + walk.title + '</h3>' +
                    '<div style="margin-bottom: 6px;">' +
                        '<span class="type-badge ' + typeInfo.class + '">' + typeInfo.text + '</span>' +
                    '</div>' +
                    (walk.description ? '<div class="item-description">' + walk.description + '</div>' : '') +
                    '<div class="item-meta">' + tracksInfo + '</div>' +
                '</div>' +
                '<button class="menu-button" onclick="toggleWalkMenu(\'' + walk.id + '\')" title="Меню">' + dotsIcon + '</button>' +
            '</div>' +
            
            '<div class="dropdown-menu" id="walk-menu-' + walk.id + '">' +
                menuItems +
            '</div>' +
        '</div>';
    }).join('');
}

async function loadTracksToSelect(selectId) {
    const { data: tracks } = await supabase
        .from('audio_tracks')
        .select('id, title')
        .order('title');
    
    const select = document.getElementById(selectId);
    const currentValue = select.value;
    select.innerHTML = '<option value="">Без трека</option>';
    if (tracks) {
        tracks.forEach(track => {
            select.innerHTML += '<option value="' + track.id + '">' + track.title + '</option>';
        });
    }
    select.value = currentValue;
}

function resetWalkSpinner() {
    document.getElementById('walkForm').classList.remove('hidden');
    document.getElementById('walkSpinner').classList.remove('active');
    document.getElementById('walkModalFooter').style.display = 'flex';
    document.getElementById('saveWalkBtn').disabled = false;
    document.getElementById('walkSpinnerText').style.color = '#666666';
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
    
    document.getElementById('typeSolo').checked = true;
    onWalkTypeChange();
    
    await loadTracksToSelect('walkTrack');
    await loadTracksToSelect('walkTrackFemale');
    await loadTracksToSelect('walkTrackMale');
    
    resetWalkSpinner();
    
    document.getElementById('walkModal').classList.add('active');
};

window.closeWalkModal = () => {
    document.getElementById('walkModal').classList.remove('active');
    editingWalkId = null;
    resetWalkSpinner();
};

window.saveWalk = async () => {
    const title = document.getElementById('walkTitle').value.trim();
    const description = document.getElementById('walkDescription').value.trim();
    const type = getSelectedWalkType();
    
    if (!title) {
        alert('Введите название прогулки');
        return;
    }
    
    document.getElementById('walkForm').classList.add('hidden');
    document.getElementById('walkSpinner').classList.add('active');
    document.getElementById('walkModalFooter').style.display = 'none';
    document.getElementById('saveWalkBtn').disabled = true;
    
    try {
        let coverUrl = null;
        
        if (selectedCoverFile) {
            document.getElementById('walkSpinnerText').textContent = '📤 Загрузка обложки...';
            
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
        
        document.getElementById('walkSpinnerText').textContent = '💾 Сохранение в базе...';
        
        const walkData = {
            title,
            description: description || null,
            type
        };
        
        if (type === 'pair') {
            walkData.audio_track_id = document.getElementById('walkTrackFemale').value || null;
            walkData.audio_track_id_2 = document.getElementById('walkTrackMale').value || null;
        } else {
            walkData.audio_track_id = document.getElementById('walkTrack').value || null;
            walkData.audio_track_id_2 = null;
        }
        
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
        
        document.getElementById('walkSpinnerText').textContent = '✅ Сохранено!';
        document.getElementById('walkSpinnerText').style.color = '#2e7d32';
        
        setTimeout(() => {
            closeWalkModal();
            loadWalks();
        }, 1000);
        
    } catch (e) {
        console.error('Ошибка сохранения прогулки:', e);
        document.getElementById('walkSpinnerText').textContent = '❌ Ошибка: ' + e.message;
        document.getElementById('walkSpinnerText').style.color = '#e94560';
        
        setTimeout(() => {
            resetWalkSpinner();
        }, 2000);
    }
};

window.editWalk = async (id) => {
    closeAllMenus();
    
    const { data: walk, error } = await supabase
        .from('walks')
        .select('*')
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
    
    setWalkType(walk.type || 'solo');
    
    await loadTracksToSelect('walkTrack');
    await loadTracksToSelect('walkTrackFemale');
    await loadTracksToSelect('walkTrackMale');
    
    if (walk.type === 'pair') {
        document.getElementById('walkTrackFemale').value = walk.audio_track_id || '';
        document.getElementById('walkTrackMale').value = walk.audio_track_id_2 || '';
    } else {
        document.getElementById('walkTrack').value = walk.audio_track_id || '';
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
    
    resetWalkSpinner();
    
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

// === ПОЛЬЗОВАТЕЛИ ===

async function callEdgeFunction(functionName, data) {
    const response = await fetch(
        SUPABASE_URL + '/functions/v1/' + functionName,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            },
            body: JSON.stringify(data)
        }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || 'Ошибка Edge Function');
    }
    
    return result;
}

async function loadUsers() {
    if (currentUserRole !== 'super_admin') {
        return;
    }
    
    closeAllMenus();
    
    const { data: users, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return;
    }
    
    const list = document.getElementById('usersList');
    if (!users || users.length === 0) {
        list.innerHTML = '<div style="color: #999999; text-align: center; padding: 40px;">Нет пользователей</div>';
        return;
    }
    
    const dotsIcon = '<svg width="16" height="4" viewBox="0 0 16 4"><circle cx="2" cy="2" r="2" fill="#666666"/><circle cx="8" cy="2" r="2" fill="#666666"/><circle cx="14" cy="2" r="2" fill="#666666"/></svg>';
    
    const roleLabels = {
        'super_admin': { text: 'Супер-админ', class: 'type-pair' },
        'admin': { text: 'Админ', class: 'type-solo' }
    };
    
    const currentEmail = document.getElementById('userEmail').textContent.split(' ')[0];
    
    list.innerHTML = users.map(user => {
        const roleInfo = roleLabels[user.role] || roleLabels['admin'];
        const isCurrentUser = user.email === currentEmail;
        
        let menuContent = '';
        
        if (isCurrentUser) {
            menuContent = '<div class="current-user-marker">Это вы</div>';
        } else {
            menuContent = 
                '<button class="track-dropdown-item" onclick="editUser(\'' + user.id + '\', \'' + user.last_name.replace(/'/g, "\\'") + '\', \'' + user.first_name.replace(/'/g, "\\'") + '\', \'' + user.email.replace(/'/g, "\\'") + '\', \'' + user.role + '\')">' +
                    '<span>✏️</span> Редактировать' +
                '</button>' +
                '<button class="track-dropdown-item danger" onclick="deleteUser(\'' + user.id + '\', \'' + user.email.replace(/'/g, "\\'") + '\')">' +
                    '<span>🗑</span> Удалить' +
                '</button>';
        }
        
        return '<div class="item-card" id="user-' + user.id + '">' +
            '<div class="item-header" style="align-items: center;">' +
                '<div class="item-info">' +
                    '<h3 class="item-title" style="margin: 0;">' + user.last_name + ' ' + user.first_name + '</h3>' +
                    '<div class="item-meta" style="margin-top: 4px;">' + user.email + '</div>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px;">' +
                    '<span class="type-badge ' + roleInfo.class + '">' + roleInfo.text + '</span>' +
                    '<button class="track-menu-button" onclick="toggleUserMenu(\'' + user.id + '\')" title="Меню">' + dotsIcon + '</button>' +
                '</div>' +
            '</div>' +
            
            '<div class="track-dropdown-menu" id="user-menu-' + user.id + '">' +
                menuContent +
            '</div>' +
        '</div>';
    }).join('');
}

window.openUserModal = () => {
    editingUserId = null;
    document.getElementById('userModalTitle').textContent = 'Добавить админа';
    document.getElementById('userLastName').value = '';
    document.getElementById('userFirstName').value = '';
    document.getElementById('userEmailInput').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('roleAdmin').checked = true;
    
    document.getElementById('superAdminOption').style.display = 
        currentUserRole === 'super_admin' ? 'block' : 'none';
    
    document.getElementById('userForm').classList.remove('hidden');
    document.getElementById('userSpinner').classList.remove('active');
    document.getElementById('userModalFooter').style.display = 'flex';
    document.getElementById('saveUserBtn').disabled = false;
    document.getElementById('userSpinnerText').style.color = '#666666';
    
    document.getElementById('userModal').classList.add('active');
};

window.closeUserModal = () => {
    document.getElementById('userModal').classList.remove('active');
    editingUserId = null;
};

window.editUser = (id, lastName, firstName, email, role) => {
    closeAllMenus();
    editingUserId = id;
    
    document.getElementById('userModalTitle').textContent = 'Редактировать админа';
    document.getElementById('userLastName').value = lastName;
    document.getElementById('userFirstName').value = firstName;
    document.getElementById('userEmailInput').value = email;
    document.getElementById('userPassword').value = '';
    
    if (role === 'super_admin') {
        document.getElementById('roleSuperAdmin').checked = true;
    } else {
        document.getElementById('roleAdmin').checked = true;
    }
    
    document.getElementById('superAdminOption').style.display = 
        currentUserRole === 'super_admin' ? 'block' : 'none';
    
    document.getElementById('userForm').classList.remove('hidden');
    document.getElementById('userSpinner').classList.remove('active');
    document.getElementById('userModalFooter').style.display = 'flex';
    document.getElementById('saveUserBtn').disabled = false;
    
    document.getElementById('userModal').classList.add('active');
};

window.saveUser = async () => {
    const lastName = document.getElementById('userLastName').value.trim();
    const firstName = document.getElementById('userFirstName').value.trim();
    const email = document.getElementById('userEmailInput').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.querySelector('input[name="userRole"]:checked').value;
    
    if (!lastName || !firstName || !email) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    if (!editingUserId && !password) {
        alert('Введите пароль для нового пользователя');
        return;
    }
    
    if (password && password.length < 6) {
        alert('Пароль должен содержать минимум 6 символов');
        return;
    }
    
    document.getElementById('userForm').classList.add('hidden');
    document.getElementById('userSpinner').classList.add('active');
    document.getElementById('userModalFooter').style.display = 'none';
    document.getElementById('saveUserBtn').disabled = true;
    
    try {
        if (editingUserId) {
            document.getElementById('userSpinnerText').textContent = '💾 Обновление данных...';
            
            await callEdgeFunction('update-admin', {
                adminId: editingUserId,
                email,
                password: password || undefined,
                firstName,
                lastName,
                role
            });
            
        } else {
            document.getElementById('userSpinnerText').textContent = '👤 Создание аккаунта...';
            
            await callEdgeFunction('create-admin', {
                email,
                password,
                firstName,
                lastName,
                role
            });
        }
        
        document.getElementById('userSpinnerText').textContent = '✅ Сохранено!';
        document.getElementById('userSpinnerText').style.color = '#2e7d32';
        
        setTimeout(() => {
            closeUserModal();
            loadUsers();
        }, 1000);
        
    } catch (e) {
        console.error('Ошибка сохранения пользователя:', e);
        document.getElementById('userSpinnerText').textContent = '❌ Ошибка: ' + e.message;
        document.getElementById('userSpinnerText').style.color = '#e94560';
        
        setTimeout(() => {
            document.getElementById('userForm').classList.remove('hidden');
            document.getElementById('userSpinner').classList.remove('active');
            document.getElementById('userModalFooter').style.display = 'flex';
            document.getElementById('saveUserBtn').disabled = false;
            document.getElementById('userSpinnerText').style.color = '#666666';
        }, 2000);
    }
};

window.deleteUser = async (id, email) => {
    closeAllMenus();
    
    if (!confirm('Удалить пользователя ' + email + '?\n\nПользователь потеряет доступ к админке.')) {
        return;
    }
    
    try {
        await callEdgeFunction('delete-admin', { adminId: id });
        loadUsers();
        
    } catch (e) {
        alert('Ошибка: ' + e.message);
        console.error(e);
    }
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return hours + ':' + mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
    } else {
        return mins + ':' + secs.toString().padStart(2, '0');
    }
}
