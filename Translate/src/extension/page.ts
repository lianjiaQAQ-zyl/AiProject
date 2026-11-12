import { batchBlocks, readTranslations } from "../shared/translation.ts";
import { collectPageBlocks } from "./page-blocks.ts";
import { createInterfaceDisplay } from "./interface-display.ts";
import { createPageDisplay } from "./page-display.ts";
import type { PageCommand, PageStatus, TranslationReply } from "./messages.ts";

function createPageController() {
  const display = createPageDisplay();
  const interfaceDisplay = createInterfaceDisplay();
  let job: ReturnType<typeof prepareJob> | undefined;
  let running = false;
  let message = "等待翻译。";

  function prepareJob() {
    const blocks = collectPageBlocks(document, display.readSource, display.has, interfaceDisplay.has);
    return {
      blocks,
      batches: batchBlocks(blocks.flatMap(block => block.parts)),
      translations: new Map<number, string>(),
      nextBatch: 0,
      nextBlock: 0,
      rendered: 0
    };
  }

  async function translate(current: ReturnType<typeof prepareJob>) {
    running = true;
    message = `正在翻译，已完成 ${current.rendered} / ${current.blocks.length} 段…`;
    try {
      while (current.nextBatch < current.batches.length) {
        const blocks = current.batches[current.nextBatch];
        const reply: TranslationReply = await chrome.runtime.sendMessage({ type: "translate-blocks", blocks });
        if (job !== current) return;
        if (reply && "error" in reply) throw new Error(reply.error);
        for (const { id, text } of readTranslations(reply, blocks)) current.translations.set(id, text);
        current.nextBatch++;
        while (current.nextBlock < current.blocks.length) {
          const { target, source, parts } = current.blocks[current.nextBlock];
          if (!parts.every(({ id }) => current.translations.has(id))) break;
          if (target.isConnected) {
            const translation = parts.map(({ id }) => current.translations.get(id)).join("\n");
            if (target instanceof Text && target.data.trim() === source) {
              interfaceDisplay.render(target, translation);
              current.rendered++;
            } else if (target instanceof HTMLElement && display.readSource(target) === source) {
              display.render(target, source, translation);
              current.rendered++;
            }
          }
          for (const { id } of parts) current.translations.delete(id);
          current.nextBlock++;
        }
        message = `已翻译 ${current.rendered} / ${current.blocks.length} 段。`;
      }
      message = `已翻译 ${current.rendered} 段。`;
      job = undefined;
      running = false;
    } catch (error) {
      if (job !== current) return;
      message = `已翻译 ${current.rendered} 段。${error instanceof Error ? error.message : "翻译失败。"}`;
      running = false;
    }
  }

  return (command: PageCommand): PageStatus => {
    if (command.type === "original") display.setOriginal(command.visible);
    if (command.type === "translation") {
      display.setTranslation(command.visible);
      interfaceDisplay.setTranslation(command.visible);
    }
    if (command.type === "restore") {
      job = undefined;
      running = false;
      display.restore();
      interfaceDisplay.restore();
      message = "已恢复原网页。";
    }
    if (command.type === "translate" && !running) {
      job ??= prepareJob();
      if (job.blocks.length) void translate(job);
      else {
        job = undefined;
        message = "没有找到尚未翻译的英文正文。";
      }
    }
    return {
      message,
      running,
      canRetry: !running && Boolean(job),
      showOriginal: display.showOriginal,
      showTranslation: display.showTranslation
    };
  };
}

const page = globalThis as typeof globalThis & { translatePage?: ReturnType<typeof createPageController> };
if (!page.translatePage) {
  const control = createPageController();
  page.translatePage = control;
  chrome.runtime.onMessage.addListener((command: PageCommand, sender, reply) => {
    if (sender.id === chrome.runtime.id) reply(control(command));
  });
}
