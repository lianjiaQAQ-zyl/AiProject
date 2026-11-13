import { MAX_IMAGE_BYTES, RECOGNIZE_IMAGE_PATH } from "../shared/local-service.ts";
import { batchBlocks, splitTranslationText } from "../shared/translation.ts";
import { postToLocalService, translateBlocks } from "./local-client.ts";
import { captureImage } from "./capture-image.ts";
import type { ImageReply } from "./web-image-client.ts";

function decodeImage(png: unknown): Blob {
  if (typeof png !== "string" || !png.startsWith("iVBORw0KGgo") ||
      png.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw new Error("图片格式或大小有误。");
  }
  const bytes = Uint8Array.from(atob(png), character => character.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

export async function translateImage(
  message: { png?: unknown; area?: unknown }, tab: chrome.tabs.Tab
): Promise<ImageReply> {
  try {
    const image = message.area === undefined ? decodeImage(message.png) : await captureImage(message.area, tab);
    if (image.size > MAX_IMAGE_BYTES) throw new Error("图片过大，已跳过。");
    const reply = await postToLocalService(RECOGNIZE_IMAGE_PATH, image, "image/png", 35_000);
    const lines = (reply as { lines?: unknown } | null)?.lines;
    if (!Array.isArray(lines) || !lines.every(line => typeof line === "string")) {
      throw new Error("图片识别结果格式有误。");
    }
    const sources = lines.map(line => line.trim()).filter(line => /[a-z]{2}/i.test(line));
    const blocks = sources.flatMap((source, lineIndex) =>
      splitTranslationText(source).map(text => ({ id: 0, text, lineIndex }))
    );
    blocks.forEach((block, id) => { block.id = id; });
    const translatedLines = sources.map(() => [] as string[]);
    for (const batch of batchBlocks(blocks)) {
      const input = batch.map(({ id, text }) => ({ id, text }));
      for (const { id, text } of await translateBlocks(input)) {
        translatedLines[blocks[id].lineIndex].push(text);
      }
    }
    return { pairs: sources.map((source, index) => ({
      source,
      translation: translatedLines[index].join("\n")
    })) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "图片翻译失败。" };
  }
}
