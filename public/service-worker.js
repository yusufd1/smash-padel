self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Smash', body: event.data ? event.data.text() : 'Session update' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Smash', {
      body: data.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: data
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
