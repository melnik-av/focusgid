const CACHE_NAME = 'audio-walk-v1';
// Укажите здесь точное имя вашего файла, если оно отличается
const AUDIO_FILE = './track.mp3'; 

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Перехватываем запросы к нашему аудиофайлу
    if (event.request.url.includes(AUDIO_FILE) || event.request.url.includes('track.mp3')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // Если есть в кэше - отдаем из кэша, иначе качаем из сети
                return cachedResponse || fetch(event.request);
            })
        );
    }
});