/* global self, clients */
self.addEventListener("push", (event) => {
  let data = { title: "Honey Well", body: "", url: "/", tag: "honeywell" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      data.body = event.data?.text() ?? "";
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/bee-192.svg",
      badge: "/icons/bee-192.svg",
      tag: data.tag || "honeywell",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification?.data?.url || "/";
  const url = new URL(raw, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
