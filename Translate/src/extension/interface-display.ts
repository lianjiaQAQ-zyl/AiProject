import { getTextBounds } from "./interface-text.ts";

interface InterfaceTranslation {
  original: string;
  rendered: string;
  translation: string;
}

export function createInterfaceDisplay() {
  const translations = new Map<Text, InterfaceTranslation>();
  const tooltips = new Map<HTMLElement, string>();
  let showTranslation = true;

  function restoreTooltips() {
    for (const [element, title] of tooltips) {
      if (element.getAttribute("title") === title) element.removeAttribute("title");
    }
    tooltips.clear();
  }

  function apply(node: Text, entry: InterfaceTranslation) {
    const parent = node.parentElement;
    if (!parent || node.data !== entry.original) return;
    const originalBox = getTextBounds(node);
    if (!originalBox.lines) return;
    const parentBounds = parent.getBoundingClientRect();
    const parentStyle = getComputedStyle(parent);
    const availableWidth = parentStyle.display === "block" && parent.childNodes.length === 1 &&
      !parent.closest("button, a, [role=button], [role=tab]")
      ? Math.max(originalBox.bounds.width, parent.clientWidth -
        parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight))
      : originalBox.bounds.width;
    const prefix = entry.original.match(/^\s*/)?.[0] ?? "";
    const suffix = entry.original.match(/\s*$/)?.[0] ?? "";

    function fits(text: string) {
      node.data = prefix + text + suffix;
      const { bounds, lines } = getTextBounds(node);
      const currentParentBounds = parent!.getBoundingClientRect();
      return lines > 0 && lines <= originalBox.lines && bounds.width <= availableWidth + 1 &&
        currentParentBounds.height <= parentBounds.height + 1 &&
        currentParentBounds.width <= parentBounds.width + 1;
    }

    const chinese = entry.translation.replace(/\s+/g, " ").trim();
    const english = entry.original.trim();
    if (!fits(`${english} / ${chinese}`) && !fits(chinese)) {
      const characters = Array.from(chinese);
      let low = 1;
      let high = characters.length - 1;
      let shortened = "";
      while (low <= high) {
        const length = Math.floor((low + high) / 2);
        const candidate = characters.slice(0, length).join("") + "…";
        if (fits(candidate)) {
          shortened = candidate;
          low = length + 1;
        } else {
          high = length - 1;
        }
      }
      node.data = shortened ? prefix + shortened + suffix : entry.original;
    }

    entry.rendered = node.data;
    const target = parent.closest<HTMLElement>("button, a, [role=button], [role=tab]") ?? parent;
    if (!target.hasAttribute("title")) {
      const title = `${chinese}\n${english}`;
      target.setAttribute("title", title);
      tooltips.set(target, title);
    }
  }

  return {
    has(node: Text) {
      const entry = translations.get(node);
      return Boolean(entry && (node.data === entry.original || node.data === entry.rendered));
    },
    render(node: Text, translation: string) {
      const entry = { original: node.data, rendered: node.data, translation };
      translations.set(node, entry);
      if (showTranslation) apply(node, entry);
    },
    setTranslation(visible: boolean) {
      if (visible === showTranslation) return;
      showTranslation = visible;
      if (!visible) restoreTooltips();
      for (const [node, entry] of translations) {
        if (!node.isConnected) continue;
        if (visible) apply(node, entry);
        else if (node.data === entry.rendered) node.data = entry.original;
      }
    },
    restore() {
      restoreTooltips();
      for (const [node, entry] of translations) {
        if (node.data === entry.rendered) node.data = entry.original;
      }
      translations.clear();
      showTranslation = true;
    }
  };
}
