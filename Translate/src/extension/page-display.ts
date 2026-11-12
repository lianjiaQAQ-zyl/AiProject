const RESULT_CLASS = "llm-translate-result";
const HIDE_CLASS = "llm-translate-hide";

interface RenderedTranslation {
  source: string;
  result: HTMLElement;
  original: HTMLElement;
}

function wrapListItemContent(item: HTMLElement) {
  const original = item.ownerDocument.createElement("span");
  original.append(...item.childNodes);
  item.append(original);
  return original;
}

function constrainTranslationWidth(original: HTMLElement, result: HTMLElement) {
  const width = original.offsetWidth;
  if (width > 0) result.style.maxWidth = `min(100%, ${width}px)`;
}

export function createPageDisplay() {
  const rendered = new Map<HTMLElement, RenderedTranslation>();
  const resizeObserver = new ResizeObserver(entries => {
    for (const { target } of entries) {
      if (!(target instanceof HTMLElement)) continue;
      const translation = rendered.get(target);
      if (translation) constrainTranslationWidth(target, translation.result);
    }
  });
  let showOriginal = true;
  let showTranslation = true;

  function updateVisibility() {
    for (const { result, original } of rendered.values()) {
      result.classList.toggle(HIDE_CLASS, !showTranslation);
      original.classList.toggle(HIDE_CLASS, showTranslation && !showOriginal);
    }
  }

  return {
    get showOriginal() { return showOriginal; },
    get showTranslation() { return showTranslation; },
    setOriginal(visible: boolean) {
      showOriginal = visible;
      updateVisibility();
    },
    setTranslation(visible: boolean) {
      showTranslation = visible;
      updateVisibility();
    },
    readSource(element: HTMLElement) {
      const original = rendered.get(element)?.original ?? element;
      return original.classList.contains(HIDE_CLASS) ? "" : original.innerText.trim();
    },
    has(element: HTMLElement, source: string) {
      return rendered.get(element)?.source === source;
    },
    render(element: HTMLElement, source: string, translation: string) {
      const previous = rendered.get(element);
      const original = previous?.original ??
        (element.localName === "li" ? wrapListItemContent(element) : element);
      const result = element.ownerDocument.createElement("div");
      result.className = RESULT_CLASS;
      result.lang = "zh-Hans";
      result.textContent = translation;
      result.classList.toggle(HIDE_CLASS, !showTranslation);
      previous?.result.remove();
      original.after(result);
      if (original === element) {
        constrainTranslationWidth(element, result);
        resizeObserver.observe(element, { box: "border-box" });
      }
      original.classList.toggle(HIDE_CLASS, showTranslation && !showOriginal);
      rendered.set(element, { source, result, original });
    },
    restore() {
      resizeObserver.disconnect();
      for (const [element, { result, original }] of rendered) {
        original.classList.remove(HIDE_CLASS);
        result.remove();
        if (original !== element) original.replaceWith(...original.childNodes);
      }
      rendered.clear();
      showOriginal = true;
      showTranslation = true;
    }
  };
}
