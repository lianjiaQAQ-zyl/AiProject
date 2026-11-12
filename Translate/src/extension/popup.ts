import type { PageCommand, PageStatus } from "./messages.ts";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const original = document.querySelector<HTMLInputElement>("#original")!;
const translation = document.querySelector<HTMLInputElement>("#translation")!;
const translate = document.querySelector<HTMLButtonElement>("#translate")!;
const restore = document.querySelector<HTMLButtonElement>("#restore")!;

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error("没有找到当前标签页。");
  const tabId = tab.id;
  const target = { tabId };
  await chrome.scripting.insertCSS({ target, files: ["page.css"] });
  await chrome.scripting.executeScript({ target, files: ["page.js"] });

  let busy = false;
  async function send(command: PageCommand) {
    if (busy && command.type === "status") return;
    if (command.type !== "status") busy = true;
    try {
      const result: PageStatus = await chrome.tabs.sendMessage(tabId, command);
      if (command.type === "status" && busy) return;
      status.textContent = result.message;
      original.checked = result.showOriginal;
      original.disabled = !result.showTranslation;
      translation.checked = result.showTranslation;
      translation.disabled = false;
      restore.disabled = false;
      translate.disabled = result.running;
      translate.textContent = result.canRetry ? "重试翻译" : "翻译当前页";
    } catch {
      status.textContent = "无法读取当前网页，请刷新后重试。";
    } finally {
      if (command.type !== "status") busy = false;
    }
  }

  translate.addEventListener("click", () => void send({ type: "translate" }));
  restore.addEventListener("click", () => void send({ type: "restore" }));
  original.addEventListener("change", () => void send({ type: "original", visible: original.checked }));
  translation.addEventListener("change", () => void send({ type: "translation", visible: translation.checked }));
  await send({ type: "status" });
  setInterval(() => void send({ type: "status" }), 500);
}

initialize().catch(() => {
  status.textContent = "扩展无法访问此页面，请打开普通网页后重试。";
});
