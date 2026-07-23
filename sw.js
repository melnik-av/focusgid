const CACHE_NAME = 'audio-walk-v8';

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: установка');
    self.skipWaiting();
});

// Активация - очищаем старый кэш
self.addEventListener('activate', (event) => {
    console.log('🔧 Service Worker: активация');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim());
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    // Кэшируем только аудио файлы из Supabase Storage
    if (event.request.url.includes('supabase.co/storage')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('💾 Из кэша:', event.request.url);
                    return cachedResponse;
                }
                
                console.log('📥 Загрузка:', event.request.url);
                return fetch(event.request).then(response => {
                    // Не кэшируем если ошибка
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    
                    // Клонируем ответ для кэша
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return response;
                });
            })
        );
    }
});
