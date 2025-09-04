const CACHE_NAME = 'barcode-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// 서비스 워커 설치
self.addEventListener('install', event => {
  console.log('서비스 워커 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 열기 성공');
        return cache.addAll(urlsToCache.map(url => {
          // 상대 경로를 절대 경로로 변환
          if (url.startsWith('/')) {
            return new URL(url, self.location.origin).href;
          }
          return url;
        }));
      })
      .catch(error => {
        console.error('캐시 추가 실패:', error);
      })
  );
  
  // 즉시 활성화
  self.skipWaiting();
});

// 서비스 워커 활성화
self.addEventListener('activate', event => {
  console.log('서비스 워커 활성화 중...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 모든 클라이언트에서 즉시 제어 시작
  self.clients.claim();
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
  // Supabase API 요청은 항상 네트워크를 통해 처리
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  // GET 요청만 캐시에서 처리
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에서 찾은 경우 캐시 반환, 동시에 백그라운드에서 업데이트
        if (response) {
          // 백그라운드에서 네트워크 요청으로 캐시 업데이트
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseClone);
                  });
              }
            })
            .catch(() => {
              // 네트워크 오류는 무시 (오프라인 상태)
            });
          
          return response;
        }
        
        // 캐시에 없으면 네트워크에서 가져오기
        return fetch(event.request)
          .then(response => {
            // 유효한 응답이 아닌 경우 그대로 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 응답을 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // 네트워크 실패시 오프라인 페이지 반환 (추후 구현 가능)
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// 백그라운드 동기화 (미래 기능)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('백그라운드 동기화 실행');
    // 추후 백그라운드에서 바코드 업데이트 확인 가능
  }
});

// 푸시 알림 (미래 기능)
self.addEventListener('push', event => {
  console.log('푸시 알림 수신:', event);
  
  const options = {
    body: '새로운 바코드가 업데이트되었습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '바코드 보기',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('우리집바코드', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  console.log('알림 클릭:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    // 앱 열기
    event.waitUntil(
      clients.openWindow('/')
    );
  }

});
