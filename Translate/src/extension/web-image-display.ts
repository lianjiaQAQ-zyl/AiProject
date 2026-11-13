import type { ImageTextPair } from "./web-image-client.ts";

interface ImageTranslation {
  image: HTMLImageElement;
  pairs: ImageTextPair[];
}

export function createWebImageDisplay() {
  const host = document.createElement("div");
  host.className = "llm-image-layer";
  const entries = new Map<HTMLImageElement, { button: HTMLButtonElement; url: string }>();
  let panel: HTMLElement | undefined;

  function position() {
    for (const [image, { button, url }] of entries) {
      const rect = image.getBoundingClientRect();
      button.hidden = !image.isConnected || image.currentSrc !== url || rect.bottom <= 0 ||
        rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth;
      button.style.left = `${Math.max(4, Math.min(rect.left + 6, innerWidth - button.offsetWidth - 4))}px`;
      button.style.top = `${Math.max(4, Math.min(rect.top + 6, innerHeight - button.offsetHeight - 4))}px`;
    }
  }

  function showPanel({ pairs }: ImageTranslation, button: HTMLButtonElement) {
    panel?.remove();
    const section = document.createElement("section");
    section.className = "llm-image-panel";
    section.setAttribute("aria-label", "图片译文");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "llm-image-close";
    close.setAttribute("aria-label", "关闭");
    close.textContent = "×";
    close.addEventListener("click", () => {
      section.remove();
      button.focus();
    });
    section.addEventListener("keydown", event => {
      if (event.key === "Escape") close.click();
    });
    const heading = document.createElement("h2");
    heading.textContent = "图片译文";
    const header = document.createElement("div");
    header.className = "llm-image-panel-header";
    header.append(heading, close);
    section.append(header);
    for (const { source, translation } of pairs) {
      const pair = document.createElement("div");
      pair.className = "llm-image-pair";
      const english = document.createElement("p");
      english.lang = "en";
      english.textContent = source;
      const chinese = document.createElement("p");
      chinese.lang = "zh-Hans";
      chinese.textContent = translation;
      pair.append(english, chinese);
      section.append(pair);
    }
    host.append(section);
    panel = section;
    close.focus();
  }

  return {
    position,
    start() {
      document.documentElement.append(host);
      window.addEventListener("scroll", position, true);
      window.addEventListener("resize", position);
    },
    render(entry: ImageTranslation, url: string) {
      entries.get(entry.image)?.button.remove();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "llm-image-button";
      button.textContent = "查看图片译文";
      button.addEventListener("click", () => showPanel(entry, button));
      entries.set(entry.image, { button, url });
      host.append(button);
      position();
    },
    setVisible(visible: boolean) {
      host.hidden = !visible;
      if (visible) position();
      else panel?.remove();
    },
    restore() {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      entries.clear();
      host.replaceChildren();
      host.remove();
      host.hidden = false;
      panel = undefined;
    }
  };
}
