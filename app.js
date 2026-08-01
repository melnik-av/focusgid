import { supabase } from './supabase-config.js';

console.log('🚀 Плеер запущен');

const coverContainer = document.getElementById('coverContainer');
const trackTitle = document.getElementById('trackTitle');
const trackDescription = document.getElementById('trackDescription');
const loadingState = document.getElementById('loadingState');
const keyForm = document.getElementById('keyForm');
const keyInput = document.getElementById('keyInput');
const activateBtn = document.getElementById('activateBtn');
const errorState = document.getElementById('errorState');
const progressContainer = document.getElementById('progressContainer');
const progressBarWrapper = document.getElementById('progressBarWrapper');
const progressBarFill = document.getElementById('progressBarFill');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const playBtn = document.getElementById('playBtn');
const buttonText = document.getElementById('buttonText');

let audio = null;
let isPlaying = false;
let currentTrackId = null;
let playCounted = false;

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showLoadingSpinner() {
    playBtn.classList.remove('hidden');
    playBtn.disabled = true;
    buttonText.style.display = 'none';
    
    const oldSpinner = playBtn.querySelector('.spinner');
    if (oldSpinner) oldSpinner.remove();
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    playBtn.appendChild(spinner);
}

function showButtonText(text) {
    const spinner = playBtn.querySelector('.spinner');
    if (spinner) spinner.remove();
    
    buttonText.textContent = text;
    buttonText.style.display = 'inline-block';
}

function showError(message) {
    loadingState.classList.add('hidden');
    keyForm.classList.add('hidden');
    playBtn.classList.add('hidden');
    progressContainer.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorState.textContent = message;
}

function showKeyForm(message = null) {
    loadingState.classList.add('hidden');
    playBtn.classList.add('hidden');
    progressContainer.classList.add('hidden');
    if (message) {
        errorState.classList.remove('hidden');
        errorState.textContent = message;
    }
    keyForm.classList.remove('hidden');
}

function hideAllStates() {
    loadingState.classList.add('hidden');
    keyForm.classList.add('hidden');
    errorState.classList.add('hidden');
}

function updateProgress() {
    if (audio && audio.duration) {
        const progress = audio.currentTime / audio.duration;
        progressBarFill.style.width = (progress * 100) + '%';
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
}

// Загрузка данных прогулки и трека
async function loadWalkData(walkId, role) {
    console.log('📥 Загрузка прогулки:', walkId, 'role:', role);
    
    const { data: walk, error } = await supabase
        .from('walks')
        .select(`
            *,
            audio_tracks!audio_track_id(*),
            audio_tracks_2:audio_tracks!audio_track_id_2(*)
        `)
        .eq('id', walkId)
        .single();
    
    if (error || !walk) {
        console.error('Ошибка загрузки прогулки:', error);
        throw new Error('Трек не найден или недоступен');
    }
    
    console.log('✅ Прогулка загружена:', walk.title, 'type:', walk.type);
    
    // Определяем какой трек использовать
    let track = null;
    if (walk.type === 'pair' && role) {
        if (role === 'male') {
            track = walk.audio_tracks_2;
            console.log('🎧 Выбран мужской трек:', track?.title);
        } else {
            track = walk.audio_tracks;
            console.log('🎧 Выбран женский трек:', track?.title);
        }
    } else {
        track = walk.audio_tracks;
        console.log('🎧 Выбран трек:', track?.title);
    }
    
    if (!track || !track.file_url) {
        throw new Error('Аудиотрек не найден');
    }
    
    return { walk, track };
}

async function loadWalk(walkId, role) {
    try {
        if (!walkId) {
            showError('Трек не найден или недоступен');
            return;
        }
        
        showLoadingSpinner();
        
        const { walk, track } = await loadWalkData(walkId, role);
        
        trackTitle.textContent = walk.title || 'Аудиопрогулка';
        
        if (walk.description && walk.description.trim()) {
            trackDescription.textContent = walk.description;
            trackDescription.classList.remove('hidden');
        } else {
            trackDescription.classList.add('hidden');
        }
        
        if (walk.cover_url) {
            coverContainer.innerHTML = '<img src="' + walk.cover_url + '" alt="' + walk.title + '">';
        } else {
            coverContainer.innerHTML = '<div class="cover-placeholder">🎧</div>';
        }
        
        currentTrackId = track.id;
        
        await loadAudio(track.file_url);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError(error.message || 'Трек не найден или недоступен');
    }
}

async function loadAudio(fileUrl) {
    try {
        const url = fileUrl + '?t=' + Date.now();
        
        audio = new Audio(url);
        audio.preload = 'auto';
        
        audio.addEventListener('loadedmetadata', () => {
            console.log('🕐 Длительность:', audio.duration, 'сек');
            totalTimeEl.textContent = formatTime(audio.duration);
        });
        
        audio.addEventListener('canplay', () => {
            console.log('✅ Аудио готово к воспроизведению');
            hideAllStates();
            progressContainer.classList.remove('hidden');
            
            showButtonText('Играть');
            playBtn.disabled = false;
        });
        
        audio.addEventListener('timeupdate', updateProgress);
        
        audio.addEventListener('error', (e) => {
            console.error('❌ Ошибка аудио:', e);
            
            let msg = 'Ошибка загрузки аудио';
            if (audio.error && audio.error.code === 1) msg = 'Ошибка сети';
            else if (audio.error && audio.error.code === 2) msg = 'Файл повреждён';
            else if (audio.error && audio.error.code === 4) msg = 'Формат не поддерживается';
            
            showError(msg);
        });
        
        audio.addEventListener('ended', () => {
            isPlaying = false;
            showButtonText('Играть');
            progressBarFill.style.width = '100%';
        });
        
        audio.load();
        
    } catch (error) {
        console.error('Ошибка загрузки аудио:', error);
        showError('Ошибка загрузки аудио');
    }
}

async function activateByKey(key) {
    try {
        const { data: purchase, error } = await supabase
            .from('purchases')
            .select('*, walks(*, audio_tracks!audio_track_id(*), audio_tracks_2:audio_tracks!audio_track_id_2(*))')
            .eq('access_key', key.toUpperCase())
            .eq('payment_status', 'completed')
            .single();
        
        if (error || !purchase) {
            showKeyForm('❌ Неверный ключ доступа');
            return;
        }
        
        if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
            showKeyForm('⏰ Срок аренды истек');
            return;
        }
        
        localStorage.setItem('accessKey', key.toUpperCase());
        
        console.log('✅ Ключ активирован');
        
        const walk = purchase.walks;
        const role = purchase.role || null;
        
        let track = null;
        if (walk && walk.type === 'pair' && role) {
            track = role === 'male' ? walk.audio_tracks_2 : walk.audio_tracks;
        } else if (walk) {
            track = walk.audio_tracks;
        }
        
        if (!track || !track.file_url) {
            showError('Аудиотрек не найден');
            return;
        }
        
        trackTitle.textContent = walk.title || 'Аудиопрогулка';
        
        if (walk.description && walk.description.trim()) {
            trackDescription.textContent = walk.description;
            trackDescription.classList.remove('hidden');
        }
        
        if (walk.cover_url) {
            coverContainer.innerHTML = '<img src="' + walk.cover_url + '" alt="' + walk.title + '">';
        } else {
            coverContainer.innerHTML = '<div class="cover-placeholder">🎧</div>';
        }
        
        currentTrackId = track.id;
        
        await loadAudio(track.file_url);
        
    } catch (e) {
        console.error('Ошибка активации:', e);
        showKeyForm('Ошибка активации');
    }
}

async function incrementPlayCount() {
    if (!currentTrackId || playCounted) return;
    
    try {
        const { error } = await supabase.rpc('increment_play_count', {
            track_id: currentTrackId
        });
        
        if (error) {
            console.error('Ошибка счетчика:', error);
        } else {
            playCounted = true;
            console.log('✅ Счетчик увеличен');
        }
    } catch (e) {
        console.error('Ошибка статистики:', e);
    }
}

playBtn.addEventListener('click', async () => {
    if (!audio || playBtn.disabled) return;
    
    if (isPlaying) {
        audio.pause();
        showButtonText('Играть');
        isPlaying = false;
    } else {
        try {
            await audio.play();
            showButtonText('Пауза');
            isPlaying = true;
            await incrementPlayCount();
        } catch (e) {
            console.error('Ошибка play():', e);
        }
    }
});

activateBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (key) {
        activateByKey(key);
    }
});

keyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        activateBtn.click();
    }
});

async function init() {
    const params = new URLSearchParams(window.location.search);
    
    const walkId = params.get('walk') || params.get('track');
    const role = params.get('role');
    const accessKey = params.get('key') || localStorage.getItem('accessKey');
    
    console.log('Walk ID:', walkId);
    console.log('Role:', role);
    console.log('Ключ:', accessKey ? 'Есть' : 'Нет');
    
    if (accessKey) {
        await activateByKey(accessKey);
    } else if (walkId) {
        await loadWalk(walkId, role);
    } else {
        showKeyForm('Введите ключ доступа для прослушивания');
    }
}

init();
