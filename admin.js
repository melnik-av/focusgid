import { supabase } from './supabase-config.js';

let selectedCoverFile = null;
let selectedCoverUrl = null;
let currentMenuId = null;

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
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert('Ошибка выхода: ' + error.message);
    }
};

supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('userEmail').textContent = session.user.email;
        loadTracks();
    } else {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
    }
});

window.openAddModal = () => {
    document.getElementById('addModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeAddModal = () => {
    const title = document.getElementById('title').value.trim();
    const file = document.getElementById('mp3file').files[0];
    
    if (title || file) {
        if (!confirm('Форма не заполнена. Закрыть без сохранения?')) {
            return;
        }
    }
    
    document.getElementById('addModal').classList.remove('active');
    document.body.style.overflow = '';
    
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('price').value = '500';
    document.getElementById('days').value = '7';
    document.getElementById('mp3file').value = '';
    removeCover();
    
    const status = document.getElementById('modalStatus');
    status.textContent = '';
    status.style.borderColor = '#e0e0e0';
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllMenus();
    }
});

document.getElementById('coverFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedCoverFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedCoverUrl = e.target.result;
            renderCoverPreview('coverPreview', e.target.result, true);
        };
        reader.readAsDataURL(file);
    }
});

function renderCoverPreview(containerId, imageUrl, showDelete) {
    const container = document.getElementById(containerId);
    if (showDelete && imageUrl) {
        const deleteCall = containerId === 'coverPreview' 
            ? 'removeCover()' 
            : 'removeEditCover(\'' + containerId.replace('edit-cover-preview-', '') + '\')';
        container.innerHTML = 
            '<img src="' + imageUrl + '" alt="Обложка">' +
            '<button class="cover-delete-btn" onclick="event.stopPropagation(); ' + deleteCall + '" title="Удалить обложку">🗑</button>';
    } else {
        container.innerHTML = 
            '<div class="cover-preview-placeholder">' +
                '<span class="cover-icon">+</span>' +
                'Нажмите чтобы добавить обложку' +
            '</div>';
    }
}

window.removeCover = () => {
    selectedCoverFile = null;
    selectedCoverUrl = null;
    document.getElementById('coverFile').value = '';
    renderCoverPreview('coverPreview', null, false);
};

function getQRUrl(text, size = 200) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text) + '&margin=10&color=000000&bgcolor=ffffff';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return hours + ':' + mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
    } else {
        return mins + ':' + secs.toString().padStart(2, '0');
    }
}

function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
    });
    document.getElementById('menuOverlay').classList.remove('active');
    currentMenuId = null;
}

window.toggleMenu = (id) => {
    const menu = document.getElementById('menu-' + id);
    const overlay = document.getElementById('menuOverlay');
    
    if (currentMenuId === id) {
        closeAllMenus();
        return;
    }
    
    closeAllMenus();
    
    menu.classList.add('active');
    overlay.classList.add('active');
    currentMenuId = id;
};

document.getElementById('menuOverlay').addEventListener('click', closeAllMenus);

async function loadTracks() {
    closeAllMenus();
    
    const { data: tracks, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Ошибка загрузки:', error);
        return;
    }
    
    updateTotalStats(tracks);
    
    const list = document.getElementById('tracksList');
    if (!tracks || tracks.length === 0) {
        list.innerHTML = '<div style="color: #999999; text-align: center; padding: 40px;">Нет треков</div>';
        return;
    }
    
    const playerUrl = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
    
    list.innerHTML = tracks.map(t => {
        const trackLink = playerUrl + '?track=' + t.id;
        const descriptionHtml = t.description 
            ? '<div class="track-description">' + t.description + '</div>' 
            : '';
        const qrUrl = getQRUrl(trackLink, 200);
        const playCount = t.play_count || 0;
        const lastPlayed = formatDate(t.last_played_at);
        const duration = formatDuration(t.duration);
        const coverHtml = t.cover_url 
            ? '<div class="track-cover-thumb"><img src="' + t.cover_url + '" alt="' + t.title + '"></div>'
            : '';
        
        const statusText = t.active ? 'Отключить' : 'Включить';
        const statusIcon = t.active ? '⏸' : '▶';
        
        return '<div class="track-item" id="track-' + t.id + '">' +
            '<div class="track-header">' +
                '<div class="track-header-content">' +
                    coverHtml +
                    '<div class="track-title">' + t.title + '</div>' +
                    descriptionHtml +
                    '<div class="track-meta">' + t.price + ' руб · ' + t.duration_days + ' дней · ' + duration + '</div>' +
                '</div>' +
                '<button class="menu-button" onclick="toggleMenu(\'' + t.id + '\')">⋯</button>' +
            '</div>' +
            
            '<div class="dropdown-menu" id="menu-' + t.id + '">' +
                '<button class="dropdown-item" onclick="copyLink(\'' + trackLink + '\', \'' + t.title.replace(/'/g, "\\'") + '\')">' +
                    '<span class="dropdown-icon">🔗</span> Копировать ссылку' +
                '</button>' +
                '<button class="dropdown-item" onclick="downloadQR(\'' + qrUrl + '\', \'' + t.title.replace(/'/g, "\\'") + '\')">' +
                    '<span class="dropdown-icon">📱</span> Скачать QR-код' +
                '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button class="dropdown-item" onclick="showEditForm(\'' + t.id + '\', \'' + t.title.replace(/'/g, "\\'") + '\', \'' + (t.description || '').replace(/'/g, "\\'") + '\', ' + t.price + ', ' + t.duration_days + ', \'' + (t.cover_url || '') + '\')">' +
                    '<span class="dropdown-icon">✏️</span> Редактировать' +
                '</button>' +
                '<button class="dropdown-item" onclick="toggleTrack(\'' + t.id + '\', ' + !t.active + ')">' +
                    '<span class="dropdown-icon">' + statusIcon + '</span> ' + statusText +
                '</button>' +
                '<div class="dropdown-divider"></div>' +
                '<button class="dropdown-item danger" onclick="deleteTrack(\'' + t.id + '\')">' +
                    '<span class="dropdown-icon">🗑</span> Удалить' +
                '</button>' +
            '</div>' +
            
            '<div class="track-link">' + trackLink + '</div>' +
            
            '<div class="stats-row">' +
                '<div class="stat-card">' +
                    '<div class="stat-value">' + playCount + '</div>' +
                    '<div class="stat-label">Прослушиваний</div>' +
                '</div>' +
                '<div class="stat-card">' +
                    '<div class="stat-value" style="font-size: 14px;">' + lastPlayed + '</div>' +
                    '<div class="stat-label">Последнее прослушивание</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function updateTotalStats(tracks) {
    const totalTracks = tracks.length;
    const totalPlays = tracks.reduce((sum, t) => sum + (t.play_count || 0), 0);
    
    let topTrack = tracks.reduce((max, t) => {
        return (t.play_count || 0) > (max.play_count || 0) ? t : max;
    }, tracks[0] || { play_count: 0, title: '—' });
    
    document.getElementById('totalTracks').textContent = totalTracks;
    document.getElementById('totalPlays').textContent = totalPlays;
    document.getElementById('topTrack').textContent = topTrack.play_count > 0 ? topTrack.title : '—';
}

window.showEditForm = (id, title, description, price, days, coverUrl) => {
    closeAllMenus();
    
    const trackItem = document.getElementById('track-' + id);
    const existingForm = trackItem.querySelector('.edit-form');
    
    if (existingForm) {
        existingForm.remove();
        return;
    }
    
    const form = document.createElement('div');
    form.className = 'edit-form';
    form.innerHTML = 
        '<label class="field-label">Название трека</label>' +
        '<input type="text" id="edit-title-' + id + '" value="' + title + '">' +
        
        '<label class="field-label">Описание</label>' +
        '<textarea id="edit-description-' + id + '">' + description + '</textarea>' +
        
        '<label class="field-label">Обложка</label>' +
        '<div class="cover-preview" id="edit-cover-preview-' + id + '" onclick="document.getElementById(\'edit-cover-file-' + id + '\').click()">' +
        '</div>' +
        '<input type="file" id="edit-cover-file-' + id + '" accept="image/*" style="display: none;">' +
        
        '<label class="field-label">Цена (руб)</label>' +
        '<input type="number" id="edit-price-' + id + '" value="' + price + '">' +
        
        '<label class="field-label">Дней доступа</label>' +
        '<input type="number" id="edit-days-' + id + '" value="' + days + '">' +
        
        '<div class="edit-actions">' +
            '<button class="btn-save" onclick="saveTrack(\'' + id + '\', \'' + coverUrl + '\')">Сохранить</button>' +
            '<button class="btn-cancel" onclick="loadTracks()">Отмена</button>' +
        '</div>';
    
    trackItem.appendChild(form);
    
    renderCoverPreview('edit-cover-preview-' + id, coverUrl, !!coverUrl);
    
    document.getElementById('edit-cover-file-' + id).addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                renderCoverPreview('edit-cover-preview-' + id, e.target.result, true);
                document.getElementById('edit-cover-file-' + id).dataset.newCover = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
};

window.removeEditCover = (id) => {
    renderCoverPreview('edit-cover-preview-' + id, null, false);
    document.getElementById('edit-cover-file-' + id).value = '';
    delete document.getElementById('edit-cover-file-' + id).dataset.newCover;
};

window.saveTrack = async (id, oldCoverUrl) => {
    const title = document.getElementById('edit-title-' + id).value.trim();
    const description = document.getElementById('edit-description-' + id).value.trim();
    const price = parseInt(document.getElementById('edit-price-' + id).value);
    const days = parseInt(document.getElementById('edit-days-' + id).value);
    
    if (!title) {
        alert('Название обязательно');
        return;
    }
    
    const status = document.getElementById('status');
    status.textContent = 'Сохранение...';
    
    try {
        let coverUrl = oldCoverUrl;
        
        const coverFileInput = document.getElementById('edit-cover-file-' + id);
        const newCoverData = coverFileInput.dataset.newCover;
        
        if (newCoverData) {
            status.textContent = 'Загрузка обложки...';
            
            const response = await fetch(newCoverData);
            const blob = await response.blob();
            
            const fileName = 'cover_' + Date.now() + '_' + id + '.jpg';
            const { error: uploadError } = await supabase.storage
                .from('covers')
                .upload(fileName, blob, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = supabase.storage
                .from('covers')
                .getPublicUrl(fileName);
            
            coverUrl = publicUrl;
        }
        
        const { error } = await supabase
            .from('tracks')
            .update({
                title,
                description: description || null,
                price,
                duration_days: days,
                cover_url: coverUrl
            })
            .eq('id', id);
        
        if (error) throw error;
        
        status.textContent = '✅ Изменения сохранены!';
        status.style.borderColor = '#4CAF50';
        
        setTimeout(() => {
            status.textContent = '';
            status.style.borderColor = '#e0e0e0';
        }, 3000);
        
        loadTracks();
    } catch (e) {
        status.textContent = '❌ Ошибка: ' + e.message;
        status.style.borderColor = '#e94560';
        console.error('Ошибка сохранения:', e);
    }
};

window.copyLink = async (link, title) => {
    closeAllMenus();
    try {
        await navigator.clipboard.writeText(link);
        
        const status = document.getElementById('status');
        status.textContent = '✅ Ссылка скопирована!';
        status.style.borderColor = '#4CAF50';
        
        setTimeout(() => {
            status.textContent = '';
            status.style.borderColor = '#e0e0e0';
        }, 3000);
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

window.downloadQR = async (qrUrl, title) => {
    closeAllMenus();
    try {
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'QR-' + title.replace(/[^a-z0-9а-яё]/gi, '_') + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Ошибка скачивания:', error);
        window.open(qrUrl, '_blank');
    }
};

window.toggleTrack = async (id, active) => {
    closeAllMenus();
    const { error } = await supabase
        .from('tracks')
        .update({ active })
        .eq('id', id);
    
    if (error) {
        alert('Ошибка: ' + error.message);
    } else {
        loadTracks();
    }
};

window.deleteTrack = async (id) => {
    closeAllMenus();
    if (!confirm('Удалить этот трек?')) return;
    
    const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert('Ошибка удаления: ' + error.message);
    } else {
        loadTracks();
    }
};

window.uploadTrack = async () => {
    const status = document.getElementById('modalStatus');
    const uploadBtn = document.getElementById('uploadBtn');
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const price = parseInt(document.getElementById('price').value) || 0;
    const days = parseInt(document.getElementById('days').value) || 7;
    const file = document.getElementById('mp3file').files[0];

    if (!file || !title) { 
        alert('Заполните название и выберите аудиофайл'); 
        return; 
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        alert('Вы не авторизованы. Войдите в систему.');
        return;
    }

    status.textContent = 'Загрузка аудио...';
    uploadBtn.disabled = true;

    try {
        const audioFileName = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + file.name.replace(/\s/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        
        const { error: audioUploadError } = await supabase.storage
            .from('tracks')
            .upload(audioFileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (audioUploadError) throw audioUploadError;

        const { data: { publicUrl: audioUrl } } = supabase.storage
            .from('tracks')
            .getPublicUrl(audioFileName);

        let coverUrl = null;
        if (selectedCoverFile) {
            status.textContent = 'Загрузка обложки...';
            
            const coverFileName = 'cover_' + Date.now() + '.jpg';
            const { error: coverUploadError } = await supabase.storage
                .from('covers')
                .upload(coverFileName, selectedCoverFile, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (coverUploadError) throw coverUploadError;
            
            const { data: { publicUrl: coverPublicUrl } } = supabase.storage
                .from('covers')
                .getPublicUrl(coverFileName);
            
            coverUrl = coverPublicUrl;
        }

        status.textContent = 'Создание записи в базе...';
        
        const trackData = {
            title,
            description: description || null,
            price,
            duration_days: days,
            duration: null,
            file_url: audioUrl,
            active: true,
            play_count: 0
        };
        
        if (coverUrl) {
            trackData.cover_url = coverUrl;
        }
        
        const { error: dbError } = await supabase
            .from('tracks')
            .insert(trackData)
            .select();

        if (dbError) throw dbError;
        
        status.textContent = '✅ Трек добавлен!';
        status.style.borderColor = '#4CAF50';
        
        setTimeout(() => {
            // Закрываем без проверки (форма уже обработана)
            document.getElementById('addModal').classList.remove('active');
            document.body.style.overflow = '';
            
            // Очищаем форму
            document.getElementById('title').value = '';
            document.getElementById('description').value = '';
            document.getElementById('price').value = '500';
            document.getElementById('days').value = '7';
            document.getElementById('mp3file').value = '';
            removeCover();
            
            const status = document.getElementById('modalStatus');
            status.textContent = '';
            status.style.borderColor = '#e0e0e0';
            
            loadTracks();
        }, 1500);
        
    } catch (e) {
        console.error('Ошибка:', e);
        status.textContent = '❌ Ошибка: ' + e.message;
        status.style.borderColor = '#e94560';
    } finally {
        uploadBtn.disabled = false;
    }
};