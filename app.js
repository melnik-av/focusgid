// ВАЖНО: Убедитесь, что имя файла совпадает с тем, что вы загрузили в GitHub
const AUDIO_URL = './track.mp3'; 
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах

let audio = null;
let isPlaying = false;
let wakeLock = null;

const playBtn = document.getElementById('playBtn');
const statusEl = document.getElementById('status');

// === УПРАВЛЕНИЕ ЭКРАНОМ (WAKE LOCK) ===
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Экран заблокирован от выключения');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock снят');
            });
        } catch (err) {
            console.error('Wake Lock ошибка:', err);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
}

// Возвращаем блокировку экрана, если пользователь вернулся на вкладку
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isPlaying) {
        await requestWakeLock();
    }
});

// === ЛОГИКА КЭША И ИСТЕЧЕНИЯ СРОКА ===
async function checkCache() {
    const cacheDateStr = localStorage.getItem('audioCacheDate');
    const isExpired = localStorage.getItem('audioExpired') === 'true';
    const now = Date.now();

    // 1. Если уже истекло ранее
    if (isExpired) {
        showExpired();
        return;
    }

    // 2. Если прошло больше 7 дней с момента первого скачивания
    if (cacheDateStr && (now - parseInt(cacheDateStr)) > CACHE_DURATION) {
        await clearCacheAndExpire();
        return;
    }

    // 3. Первый запуск (нет даты)
    if (!cacheDateStr) {
        await cacheAudio();
    } 
    // 4. Кэш есть и он актуален
    else {
        statusEl.textContent = '✅ Трек загружен и готов';
        enablePlayer();
    }
}

async function clearCacheAndExpire() {
    try {
        const cache = await caches.open('audio-walk-v1');
        await cache.delete(AUDIO_URL);
        localStorage.removeItem('audioCacheDate');
        localStorage.setItem('audioExpired', 'true');
        showExpired();
    } catch (error) {
        console.error('Ошибка очистки:', error);
    }
}

function showExpired() {
    statusEl.textContent = '⛔ Срок действия аудио истек.\nОбратитесь к ведущему.';
    statusEl.style.color = '#e94560';
    playBtn.disabled = true;
    playBtn.textContent = 'Недоступно';
}

async function cacheAudio() {
    try {
        statusEl.textContent = '⏳ Скачивание трека...\n(Не закрывайте страницу)';
        
        const response = await fetch(AUDIO_URL);
        if (!response.ok) throw new Error('Файл не найден');
        
        const cache = await caches.open('audio-walk-v1');
        await cache.put(AUDIO_URL, response.clone());
        
        localStorage.setItem('audioCacheDate', Date.now().toString());
        
        statusEl.textContent = '✅ Трек сохранен в телефоне';
        enablePlayer();
    } catch (error) {
        statusEl.textContent = '❌ Ошибка загрузки.\nПроверьте интернет и обновите страницу.';
        statusEl.style.color = '#e94560';
        console.error(error);
    }
}

// === ПЛЕЕР ===
function enablePlayer() {
    audio = new Audio(AUDIO_URL);
    
    // Восстановление позиции, если приложение было закрыто
    const savedTime = localStorage.getItem('audioCurrentTime');
    if (savedTime) {
        audio.currentTime = parseFloat(savedTime);
    }

    audio.addEventListener('timeupdate', () => {
        localStorage.setItem('audioCurrentTime', audio.currentTime.toString());
    });

    audio.addEventListener('ended', () => {
        isPlaying = false;
        playBtn.textContent = '▶ Играть сначала';
        releaseWakeLock();
        localStorage.removeItem('audioCurrentTime');
    });

    playBtn.disabled = false;
    playBtn.textContent = '▶ Играть';
}

playBtn.addEventListener('click', async () => {
    if (!audio) return;
    
    // Wake Lock требует взаимодействия пользователя (клик), поэтому запрашиваем его здесь
    if (!isPlaying) {
        await requestWakeLock();
    }

    if (isPlaying) {
        audio.pause();
        playBtn.textContent = '▶ Продолжить';
        await releaseWakeLock();
    } else {
        await audio.play();
        playBtn.textContent = '⏸ Пауза';
    }
    isPlaying = !isPlaying;
});

// Запуск при загрузке страницы
checkCache();