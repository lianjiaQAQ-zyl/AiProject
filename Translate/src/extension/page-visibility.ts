const EXCLUDED = [
  "script", "style", "noscript", "template", "svg", "pre", "code", "kbd", "samp",
  "input", "textarea", "select", "option", "[hidden]", "[inert]", "[aria-hidden=true]",
  "[contenteditable]:not([contenteditable=false])", "[translate=no]", ".sr-only",
  ".visually-hidden", ".screen-reader-text", ".llm-translate-result"
].join(", ");

export function createVisibilityCheck() {
  const checked = new WeakMap<Element, boolean>();
  return function isVisible(element: Element): boolean {
    const cached = checked.get(element);
    if (cached !== undefined) return cached;
    const style = getComputedStyle(element);
    const clipped = style.clipPath !== "none" &&
      (element.clientWidth <= 2 || element.clientHeight <= 2);
    const visible = !element.matches(EXCLUDED) && style.visibility === "visible" &&
      style.display !== "none" && style.opacity !== "0" && style.contentVisibility !== "hidden" &&
      style.clip === "auto" && !clipped &&
      (!element.parentElement || isVisible(element.parentElement));
    checked.set(element, visible);
    return visible;
  };
}
