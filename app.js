import { supabase } from './supabase-config.js';

console.log('🚀 Плеер запущен');

// Элементы DOM
const coverContainer = document.getElementById('coverContainer');
const trackTitle = document.getElementById('trackTitle');
const trackDescription = document.getElementById('trackDescription');
const loadingState = document.getElementById('loadingState');
const keyForm = document.getElementById('keyForm');
const keyInput = document.getElementById('keyInput');
const activateBtn = document.getElementById('activateBtn');
const errorState = document.getElementById('errorState');
const waveformContainer = document.getElementById('waveformContainer');
const waveform = document.getElementById('waveform');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const playBtn = document.getElementById('playBtn');

let audio = null;
let isPlaying = false;
let currentTrackId = null;
let playCounted = false;
let waveBars = [];
const WAVE_BARS_COUNT = 60;

// Форматирование времени
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Генерация вейвформы (случайные высоты)
function generateWaveform() {
    waveform.innerHTML = '';
    waveBars = [];
    
    for (let i = 0; i < WAVE_BARS_COUNT; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        // Случайная высота от 20% до 100%
        const height = 20 + Math.random() * 80;
        bar.style.height = `${height}%`;
        waveform.appendChild(bar);
        waveBars.push(bar);
    }
}

// Обновление вейвформы по прогрессу
function updateWaveform(progress) {
    const activeCount = Math.floor(progress * waveBars.length);
    
    waveBars.forEach((bar, index) => {
        if (index < activeCount) {
            bar.classList.add('active');
        } else {
            bar.classList.remove('active');
        }
    });
}

// Показать ошибку
function showError(message) {
    loadingState.classList.add('hidden');
    keyForm.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorState.textContent = message;
}

// Показать форму ключа
function showKeyForm(message = null) {
    loadingState.classList.add('hidden');
    if (message) {
        errorState.classList.remove('hidden');
        errorState.textContent = message;
    }
    keyForm.classList.remove('hidden');
}

// Скрыть все состояния
function hideAllStates() {
    loadingState.classList.add('hidden');
    keyForm.classList.add('hidden');
    errorState.classList.add('hidden');
}

// Загрузка трека
async function loadTrack(trackId = null) {
    try {
        let query = supabase.from('tracks').select('*').eq('active', true);
        
        if (trackId) {
            query = query.eq('id', trackId);
        }
        
        const { data, error } = await query.limit(1);
        
        if (error) throw error;
        if (!data || data.length === 0) {
            showError('Трек не найден или недоступен');
            return;
        }
        
        const track = data[0];
        currentTrackId = track.id;
        
        // Устанавливаем данные
        trackTitle.textContent = track.title || 'Аудиопрогулка';
        
        if (track.description && track.description.trim()) {
            trackDescription.textContent = track.description;
            trackDescription.classList.remove('hidden');
        }
        
        // Обложка (если есть cover_url)
        if (track.cover_url) {
            coverContainer.innerHTML = `<img src="${track.cover_url}" alt="${track.title}">`;
        }
        
        console.log('✅ Трек загружен:', track.title);
        
        // Загружаем аудио
        await loadAudio(track.file_url);
        
    } catch (error) {
        console.error('Ошибка загрузки трека:', error);
        showError('Ошибка загрузки: ' + error.message);
    }
}

// Загрузка аудио
async function loadAudio(fileUrl) {
    try {
        const url = fileUrl + '?t=' + Date.now();
        
        audio = new Audio(url);
        audio.preload = 'auto';
        
        // Метаданные загружены
        audio.addEventListener('loadedmetadata', () => {
            console.log(' Длительность:', audio.duration, 'сек');
            totalTimeEl.textContent = formatTime(audio.duration);
        });
        
        // Можно играть
        audio.addEventListener('canplay', () => {
            console.log('✅ Аудио готово');
            hideAllStates();
            generateWaveform();
            waveformContainer.classList.remove('hidden');
            playBtn.classList.remove('hidden');
            playBtn.disabled = false;
            playBtn.textContent = 'Играть';
        });
        
        // Обновление времени
        audio.addEventListener('timeupdate', () => {
            currentTimeEl.textContent = formatTime(audio.currentTime);
            
            if (audio.duration) {
                const progress = audio.currentTime / audio.duration;
                updateWaveform(progress);
            }
        });
        
        // Ошибка
        audio.addEventListener('error', (e) => {
            console.error('❌ Ошибка аудио:', e);
            console.error('Код:', audio.error?.code);
            
            let msg = 'Ошибка загрузки аудио';
            if (audio.error?.code === 1) msg = 'Ошибка сети';
            else if (audio.error?.code === 2) msg = 'Файл повреждён';
            else if (audio.error?.code === 4) msg = 'Формат не поддерживается';
            
            showError(msg);
        });
        
        // Конец воспроизведения
        audio.addEventListener('ended', () => {
            isPlaying = false;
            playBtn.textContent = 'Играть';
            updateWaveform(1);
        });
        
        audio.load();
        
    } catch (error) {
        console.error('Ошибка загрузки аудио:', error);
        showError('Ошибка загрузки аудио');
    }
}

// Активация по ключу
async function activateByKey(key) {
    try {
        const { data: purchase, error } = await supabase
            .from('purchases')
            .select('*, tracks(*)')
            .eq('access_key', key.toUpperCase())
            .eq('payment_status', 'completed')
            .single();
        
        if (error || !purchase) {
            showKeyForm('❌ Неверный ключ доступа');
            return;
        }
        
        // Проверка срока действия
        if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
            showKeyForm('⏰ Срок аренды истек');
            return;
        }
        
        // Сохраняем ключ
        localStorage.setItem('accessKey', key.toUpperCase());
        
        console.log('✅ Ключ активирован');
        await loadTrack(purchase.track_id);
        
    } catch (e) {
        console.error('Ошибка активации:', e);
        showKeyForm('Ошибка активации');
    }
}

// Увеличение счетчика прослушиваний
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

// Обработчик кнопки Play/Pause
playBtn.addEventListener('click', async () => {
    if (!audio) return;
    
    if (isPlaying) {
        audio.pause();
        playBtn.textContent = 'Играть';
        isPlaying = false;
    } else {
        try {
            await audio.play();
            playBtn.textContent = 'Пауза';
            isPlaying = true;
            await incrementPlayCount();
        } catch (e) {
            console.error('Ошибка play():', e);
        }
    }
});

// Обработчик активации ключа
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

// Инициализация
async function init() {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track');
    const accessKey = params.get('key') || localStorage.getItem('accessKey');
    
    console.log('Track ID:', trackId);
    console.log('Ключ:', accessKey ? 'Есть' : 'Нет');
    
    if (accessKey) {
        await activateByKey(accessKey);
    } else if (trackId) {
        // Если есть trackId но нет ключа - пробуем загрузить трек
        // (для админского тестирования или публичных треков)
        await loadTrack(trackId);
    } else {
        showKeyForm('Введите ключ доступа для прослушивания');
    }
}

init();
