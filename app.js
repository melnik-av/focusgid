import { supabase } from './supabase-config.js';

const CACHE_VERSION = 'v6';

let audio = null;
let isPlaying = false;
let wakeLock = null;

const playBtn = document.getElementById('playBtn');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('trackTitle');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Обновление прогресс-бара
function updateProgress(percent, text) {
    progressContainer.classList.add('active');
    progressText.classList.add('active');
    progressBar.style.width = percent + '%';
    progressText.textContent = text || `Загрузка: ${Math.round(percent)}%`;
}

function hideProgress() {
    progressContainer.classList.remove('active');
    progressText.classList.remove('active');
}

// Wake Lock - не даем экрану гаснуть
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 Wake Lock активирован');
        } catch (err) { 
            console.warn('⚠️ Wake Lock не поддерживается:', err);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock) { 
        await wakeLock.release(); 
        wakeLock = null; 
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock && document.visibilityState === 'visible' && isPlaying) {
        await requestWakeLock();
    }
});

// Получение ID трека из URL
function getTrackIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('track');
}

// Загрузка трека
async function loadTrack() {
    try {
        console.log('🚀 Подключение к Supabase...');
        statusEl.textContent = 'Подключение к Supabase...';
        
        const trackId = getTrackIdFromUrl();
        let query = supabase.from('tracks').select('*').eq('active', true);
        
        if (trackId) {
            console.log('Загрузка трека по ID:', trackId);
            query = query.eq('id', trackId);
        }
        
        query = query.limit(1);
        
        const { data, error } = await query;

        if (error) {
            console.error('❌ Ошибка базы данных:', error);
            statusEl.textContent = ` Ошибка БД: ${error.message}`;
            return;
        }

        if (!data || data.length === 0) {
            console.log('⚠️ Нет активных треков');
            statusEl.textContent = trackId 
                ? '❌ Трек не найден или недоступен' 
                : '⚠️ Нет доступных треков';
            return;
        }

        const track = data[0];
        console.log('✅ Найден трек:', track);
        titleEl.textContent = track.title || 'Аудиопрогулка';
        
        if (!track.file_url) {
            console.error(' Нет URL файла в базе');
            statusEl.textContent = '❌ Ошибка: нет ссылки на файл';
            return;
        }
        
        console.log('🎵 URL файла:', track.file_url);
        statusEl.textContent = '⏳ Скачивание трека...';
        await cacheAndPlay(track.file_url);
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error);
        statusEl.textContent = `❌ Ошибка: ${error.message}`;
    }
}

// Кэширование и воспроизведение с прогрессом
async function cacheAndPlay(fileUrl) {
    try {
        console.log(' Загрузка файла:', fileUrl);
        updateProgress(0, 'Подготовка к загрузке...');
        
        // Загружаем файл с прогрессом
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        console.log('📦 Размер файла:', total ? (total / 1024 / 1024).toFixed(2) + ' MB' : 'неизвестно');
        
        if (!total) {
            // Если размер неизвестен, просто кэшируем
            console.log('️ Размер файла неизвестен, загружаем без прогресса');
            const cache = await caches.open('audio-walk-v6');
            await cache.put(fileUrl, response.clone());
            updateProgress(100, 'Загрузка завершена');
        } else {
            // Читаем файл по частям для прогресса
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                receivedLength += value.length;
                
                const percent = (receivedLength / total) * 100;
                updateProgress(percent, `Загрузка: ${Math.round(percent)}% (${(receivedLength / 1024 / 1024).toFixed(1)} MB из ${(total / 1024 / 1024).toFixed(1)} MB)`);
            }
            
            // Собираем файл из чанков
            const blob = new Blob(chunks);
            const cacheResponse = new Response(blob, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
            
            // Кэшируем
            const cache = await caches.open('audio-walk-v6');
            await cache.put(fileUrl, cacheResponse);
        }
        
        localStorage.setItem('audioCacheDate', Date.now().toString());
        localStorage.setItem('cacheVersion', CACHE_VERSION);
        localStorage.setItem('currentTrackUrl', fileUrl);
        
        console.log('✅ Файл закэширован');
        updateProgress(100, '✅ Загрузка завершена');
        
        setTimeout(() => {
            hideProgress();
            statusEl.textContent = '✅ Трек готов к воспроизведению';
            enablePlayer(fileUrl);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка кэширования:', error);
        hideProgress();
        statusEl.textContent = ` Ошибка загрузки: ${error.message}`;
    }
}

// Активация плеера
function enablePlayer(fileUrl) {
    console.log(' Создание аудио элемента');
    
    audio = new Audio(fileUrl);
    
    // Атрибуты для iOS
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('preload', 'auto');
    audio.setAttribute('webkit-playsinline', 'true');
    
    let buttonActivated = false;
    
    const activateButton = () => {
        if (!buttonActivated) {
            console.log('✅ Активация кнопки Play');
            buttonActivated = true;
            playBtn.disabled = false;
            playBtn.textContent = '▶ Играть';
        }
    };
    
    // Множественные события для разных браузеров
    audio.addEventListener('loadedmetadata', () => {
        console.log('📊 Метаданные загружены, длительность:', audio.duration, 'сек');
        activateButton();
    }, { once: true });
    
    audio.addEventListener('loadeddata', () => {
        console.log(' Данные загружены');
        activateButton();
    }, { once: true });
    
    audio.addEventListener('canplay', () => {
        console.log('✅ Можно воспроизводить');
        activateButton();
    }, { once: true });
    
    audio.addEventListener('canplaythrough', () => {
        console.log('✅ Можно воспроизводить без остановок');
        activateButton();
    }, { once: true });
    
    // Прогресс воспроизведения
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            // Можно показать прогресс воспроизведения если нужно
        }
    });
    
    // Ошибка
    audio.addEventListener('error', (e) => {
        console.error('❌ Ошибка аудио:', e);
        console.error('Код:', audio.error?.code, 'Сообщение:', audio.error?.message);
        
        let errorMsg = '❌ Ошибка загрузки аудио';
        if (audio.error?.code === 4) errorMsg = '❌ Формат не поддерживается';
        else if (audio.error?.code === 1) errorMsg = '❌ Ошибка сети';
        else if (audio.error?.code === 2) errorMsg = '❌ Файл повреждён';
        
        statusEl.textContent = errorMsg;
        playBtn.disabled = true;
        playBtn.textContent = 'Ошибка';
    });
    
    // Окончание
    audio.addEventListener('ended', () => {
        console.log('⏹️ Воспроизведение завершено');
        isPlaying = false;
        playBtn.textContent = '▶ Играть сначала';
        releaseWakeLock();
    });
    
    // Fallback: активируем кнопку через 2 секунды
    setTimeout(() => {
        if (!buttonActivated) {
            console.log('⏰ Fallback: принудительная активация');
            activateButton();
        }
    }, 2000);
    
    // Начинаем загрузку
    console.log('🔄 Начинаем предзагрузку аудио...');
    audio.load();
}

// Обработка кнопки Play/Pause
async function handlePlayClick() {
    console.log('👆 Клик по кнопке Play');
    
    if (!audio) {
        console.error('❌ Аудио объект не создан');
        statusEl.textContent = ' Аудио не загружено';
        return;
    }
    
    if (playBtn.disabled) {
        console.warn('⚠️ Кнопка заблокирована');
        return;
    }
    
    if (!isPlaying) {
        // Пытаемся активировать Wake Lock
        await requestWakeLock();
        
        try {
            console.log('▶ Запуск воспроизведения...');
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                await playPromise;
                console.log('✅ Воспроизведение началось');
                playBtn.textContent = '⏸ Пауза';
                isPlaying = true;
            }
        } catch (error) {
            console.error('❌ Ошибка воспроизведения:', error);
            statusEl.textContent = '❌ Нажмите ещё раз для воспроизведения';
            releaseWakeLock();
        }
    } else {
        // Пауза
        audio.pause();
        console.log('⏸ Пауза');
        playBtn.textContent = '▶ Продолжить';
        isPlaying = false;
        await releaseWakeLock();
    }
}

// Обработчик клика с поддержкой touch events
playBtn.addEventListener('click', handlePlayClick);
playBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    handlePlayClick();
});

// Запуск
console.log('🚀 Запуск приложения...');
loadTrack();
