import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: handler } = await import(workerUrl.href);
  const request = new Request("http://localhost/", {
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

  if (typeof handler?.fetch === "function") {
    return handler.fetch(request, env, context);
  }

  return handler(request, env, context);
}

test("server-renders the study planner shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Study Planner<\/title>/i);
  assert.match(html, /Plan the day, run the clock, protect the focus\./);
  assert.match(html, /Today/);
  assert.match(html, /Prep Plan/);
  assert.match(html, /Write all your to-dos/);
  assert.match(html, /Choose planner date/);
  assert.match(html, /Write everything down\./);
  assert.match(html, /Click Plan on the items you want to schedule for/);
  assert.match(html, /Plan duration/);
  assert.match(html, /Minutes/);
  assert.match(html, /Due time/);
  assert.match(html, /Clear All/);
  assert.doesNotMatch(html, /Use selected date/);
  assert.doesNotMatch(html, /Apply, revise, submit, call, practice|Optional note or deadline context/);
  assert.match(html, /Timed plan for/);
  assert.doesNotMatch(html, /Use hours for 0\.5/);
  assert.doesNotMatch(html, /<span>To-Dos<\/span>/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Your site is taking shape|Study AI|DSA|fullstack|System design|React hooks/i,
  );
});

test("source is domain-neutral and uses structured prep topics", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.jsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /localStorage/);
  assert.match(page, /runningTaskId/);
  assert.match(page, /generatePrepPlan/);
  assert.match(page, /groupTodos/);
  assert.match(page, /emptyPrepTopic/);
  assert.match(page, /plannedTaskId/);
  assert.match(page, /study-planner-v2/);
  assert.match(page, /selectedDate/);
  assert.match(page, /Choose planner date/);
  assert.match(page, /plannedMinutes/);
  assert.match(page, /dueTime/);
  assert.match(page, /durationUnit/);
  assert.match(page, /splitDays/);
  assert.match(page, /sourceTodoId/);
  assert.match(page, /completeTimedTask/);
  assert.doesNotMatch(page, /Apply, revise, submit, call, practice|Optional note or deadline context/);
  assert.match(page, /Revision/);
  assert.match(page, /part \$\{part\}/);
  assert.match(page, /day\.items\.length === 0/);
  assert.doesNotMatch(page, /TimerReset|RotateCcw|Use hours for 0\.5/);
  assert.match(page, /selectedDateLabel/);
  assert.match(page, /updatePrepItemDone/);
  assert.match(page, /checked=\{Boolean\(item\.done\)\}/);
  assert.match(page, /Time to allot/);
  assert.match(page, /Days to complete/);
  assert.doesNotMatch(page, /Time to allot in minutes/);
  assert.doesNotMatch(page, /label="To-Dos"/);
  assert.doesNotMatch(page, /Study AI|DSA|fullstack|System design|React hooks|Node APIs|SQL joins/i);
  assert.match(layout, /Study Planner/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
