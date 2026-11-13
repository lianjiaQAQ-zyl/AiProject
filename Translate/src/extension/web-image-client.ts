import { visibleImageArea } from "./capture-image.ts";
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "../shared/local-service.ts";

export interface ImageTextPair {
  source: string;
  translation: string;
}

export type ImageReply = { pairs: ImageTextPair[] } | { error: string };

export async function translateWebImage(image: HTMLImageElement): Promise<ImageReply> {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法读取图片。");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let png: string | undefined;
  try {
    png = canvas.toDataURL("image/png").split(",")[1];
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error;
    return chrome.runtime.sendMessage({ type: "translate-web-image", area: visibleImageArea(image) });
  }
  if (!png || png.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw new Error("图片过大，已跳过。");
  }
  return chrome.runtime.sendMessage({ type: "translate-web-image", png });
}
