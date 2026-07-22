import { supabase } from './supabase-config.js';

const CACHE_VERSION = 'v4';

let audio = null;
let isPlaying = false;
let wakeLock = null;

const playBtn = document.getElementById('playBtn');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('trackTitle');

// Wake Lock
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) { console.error(err); }
    }
}

async function releaseWakeLock() {
    if (wakeLock) { await wakeLock.release(); wakeLock = null; }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock && document.visibilityState === 'visible' && isPlaying) {
        await requestWakeLock();
    }
});

// Загрузка трека из Supabase
async function loadTrack() {
    try {
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('active', true)
            .limit(1);

        if (error) throw error;
        if (!tracks || tracks.length === 0) {
            statusEl.textContent = '❌ Нет доступных треков';
            return;
        }

        const track = tracks[0];
        titleEl.textContent = track.title || 'Аудиопрогулка';
        
        statusEl.textContent = '⏳ Скачивание трека...';
        await cacheAndPlay(track.file_url);
    } catch (error) {
        statusEl.textContent = '❌ Ошибка загрузки: ' + error.message;
        console.error(error);
    }
}

async function cacheAndPlay(fileUrl) {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const cache = await caches.open('audio-walk-v4');
        await cache.put(fileUrl, response.clone());
        
        localStorage.setItem('audioCacheDate', Date.now().toString());
        localStorage.setItem('cacheVersion', CACHE_VERSION);
        localStorage.setItem('currentTrackUrl', fileUrl);
        
        statusEl.textContent = '✅ Трек готов';
        enablePlayer(fileUrl);
    } catch (error) {
        statusEl.textContent = '❌ Ошибка загрузки';
    }
}

function enablePlayer(fileUrl) {
    audio = new Audio(fileUrl);
    playBtn.disabled = false;
    playBtn.textContent = '▶ Играть';
    
    audio.addEventListener('ended', () => {
        isPlaying = false;
        playBtn.textContent = '▶ Играть сначала';
        releaseWakeLock();
    });
}

playBtn.addEventListener('click', async () => {
    if (!audio) return;
    
    if (!isPlaying) await requestWakeLock();

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

// Запуск
loadTrack();
