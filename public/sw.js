// Women360 service worker. It exists only to show reminder notifications (a page
// can't show them on every phone), to receive a reminder when the app is closed
// (web push), and to open the app when one is tapped. It does not cache anything,
// so it can never serve an old version of the app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Only paths inside the app: a message can never send her to another site.
function safePath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/app/dashboard";
}

// A reminder from the server while the app is closed. The text is short and generic by design: it can
// appear on a locked screen, so it never names a habit or a medicine. Browsers require that every push
// shows a notification, so a malformed message still shows a plain one.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "Women360";
  const body = typeof data.body === "string" && data.body ? data.body.slice(0, 200) : "Tap to open Women360.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // The same tag replaces an earlier notification for the same item instead of stacking a second one.
      tag: typeof data.tag === "string" && data.tag ? data.tag.slice(0, 80) : "women360-reminder",
      data: { url: safePath(data.url) },
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
