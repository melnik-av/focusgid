import { supabase } from './supabase-config.js';

console.log('🚀 ПРИЛОЖЕНИЕ ЗАПУСКАЕТСЯ');

const playBtn = document.getElementById('playBtn');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('trackTitle');

let audio = null;
let isPlaying = false;

async function init() {
    console.log('📡 Загрузка трека из Supabase...');
    statusEl.textContent = 'Подключение...';
    
    try {
        const { data, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('active', true)
            .limit(1);
        
        if (error) {
            console.error('❌ Ошибка Supabase:', error);
            statusEl.textContent = 'Ошибка БД: ' + error.message;
            return;
        }
        
        if (!data || data.length === 0) {
            statusEl.textContent = '⚠️ Нет доступных треков';
            return;
        }
        
        const track = data[0];
        console.log('✅ Трек найден:', track);
        console.log(' URL:', track.file_url);
        
        titleEl.textContent = track.title || 'Аудиопрогулка';
        statusEl.textContent = 'Загрузка аудио...';
        
        // Проверяем файл
        console.log('🔍 Проверка файла...');
        const testResponse = await fetch(track.file_url, { method: 'HEAD' });
        console.log('📊 Статус:', testResponse.status);
        console.log('📊 Content-Type:', testResponse.headers.get('content-type'));
        
        if (!testResponse.ok) {
            throw new Error(`Файл недоступен (HTTP ${testResponse.status})`);
        }
        
        // Создаем аудио
        console.log(' Создание Audio объекта...');
        audio = new Audio(track.file_url);
        
        audio.addEventListener('canplay', () => {
            console.log('✅ Аудио готово');
            statusEl.textContent = '✅ Готово к воспроизведению';
            playBtn.disabled = false;
            playBtn.textContent = '▶ Играть';
        });
        
        audio.addEventListener('error', (e) => {
            console.error('❌ Ошибка аудио:', e);
            console.error('Код:', audio.error?.code);
            console.error('Сообщение:', audio.error?.message);
            
            let errorMsg = 'Ошибка загрузки';
            if (audio.error?.code === 1) errorMsg = 'Ошибка сети';
            else if (audio.error?.code === 2) errorMsg = 'Файл повреждён';
            else if (audio.error?.code === 3) errorMsg = 'Ошибка декодирования';
            else if (audio.error?.code === 4) errorMsg = 'Формат не поддерживается';
            
            statusEl.textContent = '❌ ' + errorMsg;
        });
        
        audio.addEventListener('ended', () => {
            console.log('⏹️ Завершено');
            isPlaying = false;
            playBtn.textContent = '▶ Играть сначала';
        });
        
        audio.load();
        
    } catch (error) {
        console.error(' Ошибка:', error);
        statusEl.textContent = '❌ ' + error.message;
    }
}

playBtn.addEventListener('click', async () => {
    console.log('👆 Клик по кнопке');
    
    if (!audio) {
        console.error('❌ Audio не создан');
        statusEl.textContent = '❌ Аудио не загружено';
        return;
    }
    
    if (isPlaying) {
        audio.pause();
        playBtn.textContent = '▶ Продолжить';
        isPlaying = false;
    } else {
        try {
            await audio.play();
            playBtn.textContent = '⏸ Пауза';
            isPlaying = true;
            console.log('▶ Воспроизведение началось');
        } catch (e) {
            console.error('❌ Ошибка play():', e);
            statusEl.textContent = ' Нажмите ещё раз';
        }
    }
});

// Запуск
init();
