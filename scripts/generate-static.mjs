import { mkdir, writeFile } from "node:fs/promises";

const serverUrl = new URL("../dist/server/index.js", import.meta.url);
serverUrl.searchParams.set("static", `${process.pid}-${Date.now()}`);
const { default: handler } = await import(serverUrl.href);

const request = new Request("https://planyourstudies.netlify.app/", {
  headers: { accept: "text/html" },
});
const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};
const context = {
  waitUntil() {},
  passThroughOnException() {},
};

const response = typeof handler?.fetch === "function"
  ? await handler.fetch(request, env, context)
  : await handler(request, env, context);

if (!response.ok) {
  throw new Error(`Static render failed with ${response.status}`);
}

await mkdir(new URL("../dist/client/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/client/index.html", import.meta.url), await response.text());
