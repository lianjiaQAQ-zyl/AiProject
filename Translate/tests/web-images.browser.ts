import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright-core";
import { LOCAL_HOST, LOCAL_PORT } from "../src/shared/local-service.ts";
import { createTranslationServer } from "../src/server/http.ts";
import { recognizeImage } from "../src/server/ocr.ts";

test("Translate page recognizes visible images and removes results on restore", { timeout: 60_000 }, async t => {
  const requests: string[][] = [];
  let images = 0;
  const executable = resolve("dist/recognize-image");
  const useVision = process.platform === "darwin" && existsSync(executable);
  const api = createTranslationServer(async blocks => {
    requests.push(blocks.map(block => block.text));
    return blocks.map(({ id }) => ({ id, text: id === 0 ? "重置密码" : "CI 作业" }));
  }, async image => {
    images++;
    if (images === 2) return [];
    const lines = useVision ? await recognizeImage(image, executable) : ["Reset password"];
    return [...lines, "CI jobs"];
  });
  let screenshot: Buffer;
  const imageHost = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "image/png" });
    response.end(screenshot);
  });
  await once(imageHost.listen(0, LOCAL_HOST), "listening");
  t.after(() => imageHost.close());
  const imageAddress = imageHost.address();
  assert.ok(imageAddress && typeof imageAddress !== "string");
  const website = createServer((request, response) => {
    if (request.url?.endsWith(".png")) {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(screenshot);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><main>
      <img id="first" width="550" height="120" src="http://${LOCAL_HOST}:${imageAddress.port}/first.png">
      <div style="height:1500px"></div>
      <img id="next" width="550" height="120" src="/next.png" loading="lazy">
      </main>`);
  });
  t.after(() => { api.close(); website.close(); });
  await Promise.all([once(api.listen(0, LOCAL_HOST), "listening"), once(website.listen(0, LOCAL_HOST), "listening")]);
  const apiAddress = api.address();
  const siteAddress = website.address();
  assert.ok(apiAddress && typeof apiAddress !== "string" && siteAddress && typeof siteAddress !== "string");
  const extension = await mkdtemp(join(tmpdir(), "translate-capture-test-"));
  t.after(() => rm(extension, { recursive: true, force: true }));
  await cp("dist/extension", extension, { recursive: true });
  const manifestFile = join(extension, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  // The test opens the popup as a tab, so Chrome does not grant activeTab.
  manifest.host_permissions.push("<all_urls>");
  await writeFile(manifestFile, JSON.stringify(manifest));
  const browser = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      `--host-resolver-rules=MAP ${LOCAL_HOST}:${LOCAL_PORT} ${LOCAL_HOST}:${apiAddress.port}`
    ]
  });
  t.after(() => browser.close());
  browser.setDefaultTimeout(5000);
  const worker = browser.serviceWorkers()[0] ?? await browser.waitForEvent("serviceworker");
  const page = browser.pages()[0];
  await page.setContent('<div style="font:bold 54px Arial;background:white;color:black;padding:26px;width:498px">Reset password</div>');
  screenshot = await page.getByText("Reset password").screenshot();
  await page.goto(`http://${LOCAL_HOST}:${siteAddress.port}/`);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)?.id, page.url());
  assert.ok(tabId);
  const popup = await browser.newPage();
  await popup.addInitScript(id => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (async () => (await query({})).filter(tab => tab.id === id)) as typeof query;
  }, tabId);
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);

  const original = await page.locator("#first").boundingBox();
  await popup.waitForFunction(() => !document.querySelector<HTMLButtonElement>("#translate")?.disabled);
  await page.bringToFront();
  await popup.getByRole("button", { name: "翻译当前页" }).evaluate(button => (button as HTMLElement).click());
  const result = page.getByRole("button", { name: "查看图片译文" });
  await result.waitFor({ timeout: 40_000 }).catch(async error => {
    throw new Error(await popup.getByRole("status").textContent() ?? "图片处理失败", { cause: error });
  });
  assert.equal(images, 1);
  assert.deepEqual(requests, [["Reset password", "CI jobs"]]);
  assert.deepEqual(await page.locator("#first").boundingBox(), original);
  await result.click();
  const panel = page.getByRole("region", { name: "图片译文" });
  await panel.getByText("Reset password").waitFor();
  await panel.getByText("重置密码").waitFor();
  assert.deepEqual(await panel.locator(".llm-image-pair").allTextContents(), [
    "Reset password重置密码", "CI jobsCI 作业"
  ]);
  assert.equal(await panel.getByRole("button", { name: "关闭" }).textContent(), "×");
  await panel.getByRole("button", { name: "关闭" }).click();
  await popup.getByLabel("显示中文译文").uncheck();
  await result.waitFor({ state: "hidden" });
  await popup.getByLabel("显示中文译文").check();
  await page.locator("#next").scrollIntoViewIfNeeded();
  await popup.getByRole("status").getByText(/已检查 2 张图片/).waitFor({ timeout: 15_000 });
  assert.equal(images, 2);
  assert.equal(requests.length, 1);
  await popup.getByRole("button", { name: "恢复网页" }).click();
  assert.equal(await result.count(), 0);
  assert.equal(await panel.count(), 0);
});
