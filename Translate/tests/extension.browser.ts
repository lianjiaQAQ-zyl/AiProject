import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright-core";
import { LOCAL_HOST, LOCAL_PORT } from "../src/shared/local-service.ts";
import { createTranslationServer } from "../src/server/http.ts";

test("extension translates article text, retries failed batches and restores the page", { timeout: 30_000 }, async t => {
  const requests: string[][] = [];
  const server = createTranslationServer(async blocks => {
    requests.push(blocks.map(({ text }) => text));
    if (requests.length === 2) throw new Error("测试失败");
    return blocks.map(({ id, text }) => ({
      id, text: text === "Add file" ? "添加文件" : text === "main branch" ? "主分支" : text === "Repository overview" ? "仓库概览" : "<b>中文译文</b>"
    })).reverse();
  });
  const article = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><nav aria-label="Repository"></nav><main><article>
      <h1>Example article</h1><p id="narrow-source" style="max-inline-size: 320px">Read the <a href="#details">documentation</a>.</p>
      <pre><code>console.log("Hello")</code></pre><p hidden>Hidden text</p>
      ${Array.from({ length: 11 }, (_, index) => `<p>Example paragraph ${index + 1}</p>`).join("")}
    </article></main>`);
  });
  t.after(() => { server.close(); article.close(); });
  await Promise.all([
    once(server.listen(0, LOCAL_HOST), "listening"),
    once(article.listen(0, LOCAL_HOST), "listening")
  ]);
  const address = article.address();
  assert.ok(address && typeof address !== "string");

  const serverAddress = server.address();
  assert.ok(serverAddress && typeof serverAddress !== "string");
  const extension = resolve("dist/extension");
  const browser = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      `--host-resolver-rules=MAP ${LOCAL_HOST}:${LOCAL_PORT} ${LOCAL_HOST}:${serverAddress.port}`
    ]
  });
  t.after(() => browser.close());
  browser.setDefaultTimeout(5000);
  const worker = browser.serviceWorkers()[0] ?? await browser.waitForEvent("serviceworker");
  const page = browser.pages()[0];
  await page.goto(`http://${LOCAL_HOST}:${address.port}/`);
  const tabId = await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
    if (!tab?.id) throw new Error("找不到测试网页。");
    return tab.id;
  }, page.url());

  const popupPage = await browser.newPage();
  await popupPage.addInitScript(id => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (async () => (await query({})).filter(tab => tab.id === id)) as typeof query;
  }, tabId);
  await popupPage.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);

  await popupPage.getByRole("button", { name: "翻译当前页" }).click();
  await popupPage.getByRole("status").getByText(/测试失败/).waitFor();
  assert.equal(await page.locator(".llm-translate-result").count(), 12);
  assert.deepEqual(requests[0].slice(0, 2), ["Example article", "Read the documentation."]);
  assert.deepEqual(requests[1], ["Example paragraph 11"]);
  await popupPage.getByRole("button", { name: "重试翻译" }).click();
  await popupPage.getByRole("status").getByText(/已翻译 13 段/).waitFor();
  assert.deepEqual(requests[2], requests[1]);
  assert.equal(await page.locator("h1 + .llm-translate-result").textContent(), "<b>中文译文</b>");
  assert.equal(await page.locator(".llm-translate-result b").count(), 0);
  assert.equal(await page.locator("a").getAttribute("href"), "#details");
  const narrowSource = page.locator("#narrow-source");
  const narrowTranslation = page.locator("#narrow-source + .llm-translate-result");
  assert.equal((await narrowTranslation.boundingBox())?.width, (await narrowSource.boundingBox())?.width);
  await narrowSource.evaluate(element => element.style.maxInlineSize = "240px");
  await page.waitForFunction(() =>
    document.querySelector("#narrow-source + .llm-translate-result")?.getBoundingClientRect().width === 240
  );
  await popupPage.getByLabel("显示正文英文").uncheck();
  await narrowSource.waitFor({ state: "hidden" });
  assert.equal((await narrowTranslation.boundingBox())?.width, 240);
  await popupPage.getByLabel("显示正文英文").check();

  await popupPage.getByLabel("显示中文译文").uncheck();
  await page.locator(".llm-translate-result").first().waitFor({ state: "hidden" });
  await popupPage.getByLabel("显示中文译文").check();
  const longParagraph = "Long example ".repeat(250).trim();
  await page.locator("article").evaluate((article, source) => {
    const paragraph = document.createElement("p");
    paragraph.id = "long-paragraph";
    paragraph.textContent = source;
    article.append(paragraph);
  }, longParagraph);
  await popupPage.getByRole("button", { name: "翻译当前页" }).click();
  const longTranslation = page.locator("#long-paragraph + .llm-translate-result");
  await longTranslation.waitFor();
  assert.deepEqual(requests.slice(3).flat().join(" "), longParagraph);
  assert.ok(requests.slice(3).flat().every(text => text.length <= 3200));
  assert.equal(await longTranslation.textContent(), "<b>中文译文</b>\n<b>中文译文</b>");
  assert.equal(await page.locator(".llm-translate-result").count(), 14);

  await page.locator("article").evaluate(article => {
    article.insertAdjacentHTML("beforeend", '<ol start="3"><li><a href="#first">First step</a></li><li value="7">Second step</li></ol>');
  });
  const list = page.locator("ol");
  const listTranslations = list.locator(".llm-translate-result");
  await popupPage.getByRole("button", { name: "翻译当前页" }).click();
  await listTranslations.nth(1).waitFor();
  assert.deepEqual(await list.locator(":scope > li").evaluateAll(items => items.map(item => ({
    value: item.getAttribute("value"), translation: item.querySelector(".llm-translate-result")?.textContent
  }))), [
    { value: null, translation: "<b>中文译文</b>" },
    { value: "7", translation: "<b>中文译文</b>" }
  ]);
  await popupPage.getByRole("button", { name: "翻译当前页" }).click();
  await popupPage.getByRole("status").getByText(/没有找到尚未翻译/).waitFor();
  await popupPage.getByLabel("显示正文英文").uncheck();
  await list.locator("a").waitFor({ state: "hidden" });
  assert.equal(await listTranslations.nth(0).isVisible(), true);
  assert.equal(await list.locator(":scope > li").first().evaluate(item => getComputedStyle(item).display), "list-item");
  await popupPage.getByLabel("显示中文译文").uncheck();
  await list.locator("a").waitFor();
  await listTranslations.nth(0).waitFor({ state: "hidden" });
  await popupPage.getByLabel("显示中文译文").check();
  await listTranslations.nth(0).waitFor();

  await page.locator("nav").evaluate(nav => {
    nav.innerHTML = `<div style="display:flex;gap:8px">
      <button id="add-file" style="font:16px/20px Arial">Add file</button>
      <a id="branch" href="#branch" style="font:16px/20px Arial">main branch</a>
      <h2 style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Latest commit</h2>
      <span>存放 vibecoding 的一些项目</span>
      <div id="wide-label" style="width:400px;font:16px/20px Arial">Repository overview</div>
    </div>`;
    nav.querySelector("button")?.addEventListener("click", event => {
      (event.currentTarget as HTMLElement).dataset.clicked = "true";
    });
  });
  const button = page.locator("#add-file");
  const branch = page.locator("#branch");
  const buttonHeight = (await button.boundingBox())?.height;
  await popupPage.getByRole("button", { name: "翻译当前页" }).click();
  await popupPage.getByRole("status").getByText(/已翻译 3 段/).waitFor();
  assert.deepEqual(requests.at(-1), ["Add file", "main branch", "Repository overview"]);
  assert.match(await button.textContent() ?? "", /添/);
  assert.equal((await button.boundingBox())?.height, buttonHeight);
  assert.equal(await branch.getAttribute("href"), "#branch");
  assert.equal(await branch.textContent(), "主分支");
  assert.equal(await page.locator("#wide-label").textContent(), "Repository overview / 仓库概览");
  assert.equal(await page.locator("nav .llm-translate-result").count(), 0);
  await button.click();
  assert.equal(await button.getAttribute("data-clicked"), "true");
  await popupPage.getByLabel("显示中文译文").uncheck();
  assert.equal(await button.textContent(), "Add file");
  await popupPage.getByLabel("显示中文译文").check();

  await popupPage.getByRole("button", { name: "恢复网页" }).click();
  await page.locator(".llm-translate-result").first().waitFor({ state: "detached" });
  assert.equal(await list.locator(":scope > li > a").getAttribute("href"), "#first");
  assert.equal(await list.getAttribute("start"), "3");
  assert.equal(await button.textContent(), "Add file");
});
