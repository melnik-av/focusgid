import { supabase } from './supabase-config.js';

const CACHE_VERSION = 'v7';

let audio = null;
let isPlaying = false;
let wakeLock = null;

const playBtn = document.getElementById('playBtn');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('trackTitle');

console.log('🔍 Элементы:', { playBtn, statusEl, titleEl });

// Wake Lock
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 Wake Lock активирован');
        } catch (err) { 
            console.log('⚠️ Wake Lock не поддерживается');
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock) { 
        await wakeLock.release(); 
        wakeLock = null; 
    }
}

// Загрузка трека
async function loadTrack() {
    try {
        console.log('🚀 Загрузка трека...');
        statusEl.textContent = 'Подключение к Supabase...';
        
        const { data, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('active', true)
            .limit(1);

        if (error) throw error;
        if (!data || data.length === 0) {
            statusEl.textContent = '⚠️ Нет доступных треков';
            return;
        }

        const track = data[0];
        console.log('✅ Трек:', track.title);
        titleEl.textContent = track.title;
        
        statusEl.textContent = '⏳ Загрузка...';
        await downloadAndPlay(track.file_url);
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        statusEl.textContent = `❌ ${error.message}`;
    }
}

// Загрузка и воспроизведение
async function downloadAndPlay(fileUrl) {
    try {
        console.log('📥 Загрузка файла...');
        
        // Простая загрузка без прогресса
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        // Кэшируем
        const cache = await caches.open('audio-walk-v7');
        await cache.put(fileUrl, response.clone());
        
        console.log('✅ Файл загружен');
        statusEl.textContent = '✅ Готово';
        
        // Создаем аудио
        audio = new Audio(fileUrl);
        
        audio.addEventListener('canplay', () => {
            console.log('✅ Можно играть');
            playBtn.disabled = false;
            playBtn.textContent = '▶ Играть';
        });
        
        audio.addEventListener('error', (e) => {
            console.error('❌ Ошибка аудио:', e);
            statusEl.textContent = '❌ Ошибка воспроизведения';
        });
        
        audio.addEventListener('ended', () => {
            isPlaying = false;
            playBtn.textContent = '▶ Играть сначала';
            releaseWakeLock();
        });
        
        audio.load();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        statusEl.textContent = `❌ ${error.message}`;
    }
}

// Кнопка Play
playBtn.addEventListener('click', async () => {
    console.log(' Клик по кнопке');
    
    if (!audio) {
        console.error(' Аудио не создано');
        return;
    }
    
    if (isPlaying) {
        audio.pause();
        playBtn.textContent = '▶ Продолжить';
        isPlaying = false;
        releaseWakeLock();
    } else {
        await requestWakeLock();
        try {
            await audio.play();
            playBtn.textContent = '⏸ Пауза';
            isPlaying = true;
            console.log('▶ Воспроизведение началось');
        } catch (e) {
            console.error('❌ Ошибка play():', e);
            statusEl.textContent = '❌ Нажмите ещё раз';
        }
    }
});

// Запуск
loadTrack();
