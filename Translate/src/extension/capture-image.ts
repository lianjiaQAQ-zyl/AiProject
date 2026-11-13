import { MAX_IMAGE_EDGE } from "../shared/local-service.ts";

export function visibleImageArea(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  return [
    Math.max(0, rect.left / innerWidth),
    Math.max(0, rect.top / innerHeight),
    Math.min(1, rect.right / innerWidth),
    Math.min(1, rect.bottom / innerHeight)
  ];
}

export async function captureImage(area: unknown, tab: chrome.tabs.Tab): Promise<Blob> {
  if (!Array.isArray(area) || area.length !== 4 ||
      !area.every(value => typeof value === "number" && value >= 0 && value <= 1)) {
    throw new Error("图片截图区域无效。");
  }
  const [left, top, right, bottom] = area;
  if (right <= left || bottom <= top) throw new Error("图片已离开可见区域。");

  async function checkTab() {
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id || active?.url !== tab.url) throw new Error("请切回图片所在的标签页后重试。");
  }

  await checkTab();
  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  await checkTab();
  const bitmap = await createImageBitmap(await (await fetch(screenshot)).blob());
  try {
    const width = Math.max(1, Math.round((right - left) * bitmap.width));
    const height = Math.max(1, Math.round((bottom - top) * bitmap.height));
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法裁剪图片截图。");
    context.drawImage(bitmap, Math.round(left * bitmap.width), Math.round(top * bitmap.height),
      width, height, 0, 0, canvas.width, canvas.height);
    return await canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
  }
}
