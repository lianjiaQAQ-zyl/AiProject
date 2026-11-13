import { translateWebImage } from "./web-image-client.ts";
import { createWebImageDisplay } from "./web-image-display.ts";

const EXCLUDED = "nav, header, footer, [hidden], [inert], [aria-hidden=true], [translate=no]";
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;

export function createWebImageController() {
  const display = createWebImageDisplay();
  let session: { checked: number; translated: number; skipped: number; pending: Set<HTMLImageElement>; error?: string } | undefined;
  let seen = new WeakMap<HTMLImageElement, string>();
  let activeSession: typeof session;

  function enqueue(image: HTMLImageElement) {
    if (!session || !image.complete || !image.currentSrc || image.closest(EXCLUDED) ||
        image.naturalWidth < MIN_WIDTH || image.naturalHeight < MIN_HEIGHT ||
        seen.get(image) === image.currentSrc) return;
    const rect = image.getBoundingClientRect();
    if (rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT ||
        rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth ||
        getComputedStyle(image).visibility !== "visible") return;
    session.pending.add(image);
  }

  async function processImages() {
    if (activeSession) return;
    try {
      while (session?.pending.size) {
        const current = session;
        activeSession = current;
        const image = current.pending.values().next().value!;
        current.pending.delete(image);
        const url = image.currentSrc;
        if (!image.isConnected || seen.get(image) === url) continue;
        seen.set(image, url);
        try {
          const reply = await translateWebImage(image);
          if (session !== current || !image.isConnected || image.currentSrc !== url) continue;
          if ("error" in reply) {
            current.skipped++;
            current.error = reply.error;
          }
          else if (reply.pairs.length) {
            display.render({ image, ...reply }, url);
            current.translated++;
          }
        } catch (error) {
          if (session === current) {
            current.skipped++;
            current.error = error instanceof Error ? error.message : "图片处理失败。";
          }
        } finally {
          if (session === current) current.checked++;
        }
      }
    } finally {
      activeSession = undefined;
    }
  }

  const intersection = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && target instanceof HTMLImageElement) enqueue(target);
    }
    void processImages();
  });

  function imageLoaded(event: Event) {
    if (event.target instanceof HTMLImageElement) {
      enqueue(event.target);
      void processImages();
    }
  }

  const additions = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLImageElement) intersection.observe(node);
        else if (node instanceof Element) node.querySelectorAll("img").forEach(img => intersection.observe(img));
      }
    }
  });

  return {
    start() {
      if (session) return;
      session = { checked: 0, translated: 0, skipped: 0, pending: new Set() };
      display.start();
      Array.from(document.images).forEach(img => intersection.observe(img));
      document.addEventListener("load", imageLoaded, true);
      additions.observe(document.documentElement, { subtree: true, childList: true });
    },
    status() {
      if (!session) return "";
      const { checked, translated, skipped } = session;
      const summary = checked
        ? ` 已检查 ${checked} 张图片，${translated} 张有译文${skipped ? `，${skipped} 张无法处理` : ""}。`
        : "";
      return summary + (session.error ? ` ${session.error}` : "") +
        (activeSession === session ? " 正在处理网页图片…" : "");
    },
    setVisible: display.setVisible,
    refreshPositions: display.position,
    restore() {
      session = undefined;
      seen = new WeakMap();
      intersection.disconnect();
      additions.disconnect();
      document.removeEventListener("load", imageLoaded, true);
      display.restore();
    }
  };
}
