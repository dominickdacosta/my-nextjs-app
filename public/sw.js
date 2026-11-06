self.addEventListener("push", (event) => {
  let message = { body: "It's time for your health check-in.", url: "/more" };
  if (event.data) {
    try {
      message = { ...message, ...event.data.json() };
    } catch {
      // Use the generic message when a push payload cannot be parsed.
    }
  }
  event.waitUntil(
    self.registration.showNotification("Vitals", {
      body: message.body,
      icon: "/icons/vitals.svg",
      badge: "/icons/vitals.svg",
      data: { url: "/more" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) return existing.focus();
      return self.clients.openWindow("/more");
    }),
  );
});
