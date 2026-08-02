import { supabase } from './supabase-config.js';

// ⚠️ ЗАМЕНИТЕ НА EMAIL СУПЕР-АДМИНА
const SUPER_ADMIN_EMAIL = 'andreyname@gmail.com';

let currentTab = 'walks';
let selectedCoverFile = null;
let selectedCoverUrl = null;
let editingWalkId = null;
let editingTrackId = null;
let currentUserProfile = null;

// === ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ===

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    if (tab === 'walks') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('walksTab').classList.add('active');
        loadWalks();
    } else if (tab === 'tracks') {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('tracksTab').classList.add('active');
        loadTracks();
    } else if (tab === 'users') {
        document.querySelectorAll('.tab')[2].classList.add('active');
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
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.textContent = '❌ ' + error.message;
        return;
    }
    
    // Проверяем профиль пользователя
    await checkUserProfile(data.user);
};

window.logout = async () => {
    await supabase.auth.signOut();
};

// Проверка и создание профиля пользователя
async function checkUserProfile(user) {
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
    
    if (profile) {
        // Профиль существует
        if (!profile.approved && profile.role !== 'admin') {
            // Ведущий не одобрен
            alert('Ваш аккаунт ещё не одобрен администратором');
            await supabase.auth.signOut();
            return;
        }
        
        currentUserProfile = profile;
        showAdminPanel(user, profile);
    } else {
        // Профиль не существует
        if (user.email === SUPER_ADMIN_EMAIL) {
            // Создаём профиль супер-админа
            const { error } = await supabase
                .from('user_profiles')
                .insert({
                    user_id: user.id,
                    role: 'admin',
                    name: 'Администратор',
                    email: user.email,
                    approved: true
                });
            
            if (error) {
                console.error('Ошибка создания профиля админа:', error);
                alert('Ошибка создания профиля');
                await supabase.auth.signOut();
                return;
            }
            
            currentUserProfile = {
                user_id: user.id,
                role: 'admin',
                name: 'Администратор',
                email: user.email,
                approved: true
            };
            
            showAdminPanel(user, currentUserProfile);
        } else {
            // Обычный пользователь без профиля
            alert('Профиль не найден. Обратитесь к администратору.');
            await supabase.auth.signOut();
        }
    }
}

function showAdminPanel(user, profile) {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('userEmail').textContent = user.email;
    
    const roleEl = document.getElementById('userRole');
    if (profile.role === 'admin') {
        roleEl.innerHTML = '<span class="role-badge role-admin">Администратор</span>';
        document.getElementById('usersTab').style.display = 'block';
    } else {
        roleEl.innerHTML = '<span class="role-badge role-host">Ведущий</span>';
        document.getElementById('usersTab').style.display = 'none';
    }
    
    loadWalks();
}

// Регистрация ведущего
window.registerHost = async () => {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const bio = document.getElementById('regBio').value.trim();
    const password = document.getElementById('regPassword').value;
    const errorEl = document.getElementById('registerError');
    const successEl = document.getElementById('registerSuccess');
    
    errorEl.textContent = '';
    successEl.textContent = '';
    
    if (!name || !email || !password) {
        errorEl.textContent = 'Заполните обязательные поля';
        return;
    }
    
    // Создаём пользователя в auth
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name
            }
        }
    });
    
    if (error) {
        errorEl.textContent = '❌ ' + error.message;
        return;
    }
    
    // Создаём профиль в user_profiles
    const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
            user_id: data.user.id,
            role: 'host',
            name: name,
            email: email,
            phone: phone || null,
            bio: bio || null,
            approved: false
        });
    
    if (profileError) {
        errorEl.textContent = '❌ Ошибка создания профиля: ' + profileError.message;
        return;
    }
    
    successEl.textContent = '✅ Заявка отправлена! Ожидайте одобрения администратора.';
    
    // Очищаем форму
    document.getElementById('regName').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPhone').value = '';
    document.getElementById('regBio').value = '';
    document.getElementById('regPassword').value = '';
};

window.showRegisterForm = () => {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
};

window.showLoginForm = () => {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
};

// === ОБЛОЖКА ===

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

// === ПОЛЬЗОВАТЕЛИ ===

async function loadUsers() {
    if (currentUserProfile.role !== 'admin') {
        return;
    }
    
    const { data: users, error } = await supabase
        .from('user_profiles')
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
    
    list.innerHTML = users.map(user => {
        const roleBadge = user.role === 'admin' 
            ? '<span class="role-badge role-admin">Админ</span>'
            : '<span class="role-badge role-host">Ведущий</span>';
        
        const pendingBadge = !user.approved ? '<span class="pending-badge">Ожидает одобрения</span>' : '';
        
        let actions = '';
        if (user.user_id !== currentUserProfile.user_id) {
            if (!user.approved && user.role === 'host') {
                actions = `
                    <button class="btn btn-success" onclick="approveUser('${user.user_id}')">Одобрить</button>
                    <button class="btn btn-danger" onclick="rejectUser('${user.user_id}')">Отклонить</button>
                `;
            } else {
                actions = `
                    <button class="btn btn-danger" onclick="deleteUser('${user.user_id}')">Удалить</button>
                `;
            }
        }
        
        return '<div class="item-card">' +
            '<div class="user-card">' +
                '<div class="user-card-info">' +
                    '<div class="user-card-name">' + user.name + pendingBadge + '</div>' +
                    '<div class="user-card-email">' + user.email + '</div>' +
                    '<div>' + roleBadge + '</div>' +
                    (user.phone ? '<div style="font-size: 13px; color: #999999; margin-top: 4px;"> ' + user.phone + '</div>' : '') +
                    (user.bio ? '<div style="font-size: 13px; color: #666666; margin-top: 8px; line-height: 1.4;">' + user.bio + '</div>' : '') +
                '</div>' +
                '<div class="user-card-actions">' +
                    actions +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

window.approveUser = async (userId) => {
    if (!confirm('Одобрить этого пользователя?')) return;
    
    const { error } = await supabase
        .from('user_profiles')
        .update({ approved: true })
        .eq('user_id', userId);
    
    if (error) {
        alert('Ошибка: ' + error.message);
    } else {
        loadUsers();
    }
};

window.rejectUser = async (userId) => {
    if (!confirm('Отклонить и удалить этого пользователя?')) return;
    
    // Удаляем пользователя из auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
        alert('Ошибка удаления: ' + authError.message);
        return;
    }
    
    // Профиль удалится автоматически через ON DELETE CASCADE
    
    loadUsers();
};

window.deleteUser = async (userId) => {
    if (!confirm('Удалить этого пользователя?')) return;
    
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
        alert('Ошибка удаления: ' + authError.message);
        return;
    }
    
    loadUsers();
};

// === АУДИОТРЕКИ ===

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
        
        document.getElementById('spinnerText').textContent = '️ Определение длительности...';
        
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
    
    let query = supabase
        .from('walks')
        .select('*, audio_tracks!audio_track_id(title), audio_tracks_2:audio_tracks!audio_track_id_2(title)')
        .order('created_at', { ascending: false });
    
    // Ведущие видят только свои прогулки
    if (currentUserProfile && currentUserProfile.role === 'host') {
        query = query.eq('host_id', currentUserProfile.user_id);
    }
    
    const { data: walks, error } = await query;
    
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
            : '<div class="item-cover-placeholder">🚶</div>';
        
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
                    '<span class="dropdown-icon">👩</span> Ссылка для неё' +
                '</button>' +
                '<button class="dropdown-item" onclick="copyWalkLink(\'' + maleLink + '\', \'' + walk.title.replace(/'/g, "\\'") + ' (он)\')">' +
                    '<span class="dropdown-icon">👨</span> Ссылка для него' +
                '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button class="dropdown-item" onclick="editWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon">✏️</span> Редактировать' +
                '</button>' +
                '<button class="dropdown-item danger" onclick="deleteWalk(\'' + walk.id + '\')">' +
                    '<span class="dropdown-icon"></span> Удалить' +
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
            type,
            host_id: currentUserProfile.user_id
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
    
    // Проверка прав (ведущий может редактировать только свои)
    if (currentUserProfile.role === 'host' && walk.host_id !== currentUserProfile.user_id) {
        alert('У вас нет прав на редактирование этой прогулки');
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
