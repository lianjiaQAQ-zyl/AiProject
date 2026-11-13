import { translateImage } from "./translate-image.ts";
import { isTranslationBatch } from "../shared/translation.ts";
import { translateBlocks } from "./local-client.ts";
import type { TranslationReply } from "./messages.ts";

async function requestTranslation(blocks: unknown): Promise<TranslationReply> {
  if (!isTranslationBatch(blocks)) return { error: "待翻译段落格式有误。" };
  try {
    return { translations: await translateBlocks(blocks) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "翻译请求失败。" };
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !sender.tab) return;
  if (message?.type === "translate-web-image") {
    void translateImage(message, sender.tab).then(reply);
    return true;
  }
  if (message?.type !== "translate-blocks") return;
  void requestTranslation(message.blocks).then(reply);
  return true;
});
