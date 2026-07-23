const CACHE_NAME = 'audio-walk-v7';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(names => 
            Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
        )
    );
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('supabase.co/storage')) {
        event.respondWith(
            caches.match(event.request).then(r => r || fetch(event.request))
        );
    }
});
