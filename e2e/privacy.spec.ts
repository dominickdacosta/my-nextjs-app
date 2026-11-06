import { expect, test } from "@playwright/test";

test("unauthenticated visitors are redirected away from health pages", async ({
  page,
}) => {
  await page.goto("/more");
  await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
});

test("health APIs reject unauthenticated requests", async ({ request }) => {
  const response = await request.get("/api/day");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
});

test("the public PWA manifest is available without a session", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({
    display: "standalone",
    short_name: "Vitals",
  });
});
