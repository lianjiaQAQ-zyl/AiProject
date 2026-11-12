import { MAX_BATCH_CHARACTERS, type TextBlock } from "../shared/translation.ts";

const BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, dd, dt";
const EXCLUDED = [
  "nav", "footer", "aside", "form", "pre", "[hidden]", "[inert]", "[aria-hidden=true]",
  "[contenteditable]:not([contenteditable=false])", ".llm-translate-result"
].join(", ");
const MAX_PARAGRAPH_CHARACTERS = 16_000;

export interface PageBlock {
  element: HTMLElement;
  source: string;
  parts: TextBlock[];
}

function splitText(text: string): string[] {
  const parts = [];
  while (text.length > MAX_BATCH_CHARACTERS) {
    const space = text.lastIndexOf(" ", MAX_BATCH_CHARACTERS);
    let end = space > MAX_BATCH_CHARACTERS / 2 ? space : MAX_BATCH_CHARACTERS;
    const previous = text.charCodeAt(end - 1);
    if (previous >= 0xd800 && previous <= 0xdbff) end--;
    parts.push(text.slice(0, end).trim());
    text = text.slice(end).trimStart();
  }
  if (text) parts.push(text);
  return parts;
}

export function collectPageBlocks(
  document: Document,
  readSource: (element: HTMLElement) => string,
  isTranslated: (element: HTMLElement, source: string) => boolean
) {
  const main = document.querySelector("main, [role=main]") ?? document.body;
  const articles = main.querySelectorAll("article");
  const root = articles.length === 1 ? articles[0] : main;
  const blocks: PageBlock[] = [];
  let id = 1;
  for (const element of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (element.closest(EXCLUDED) || element.querySelector(`${BLOCK_SELECTOR}, pre, button, input, select, textarea`) ||
        !element.getClientRects().length || getComputedStyle(element).visibility !== "visible") continue;
    const source = readSource(element);
    if (!/[a-z]{2}/i.test(source) || source.length > MAX_PARAGRAPH_CHARACTERS || isTranslated(element, source)) continue;
    blocks.push({ element, source, parts: splitText(source).map(text => ({ id: id++, text })) });
  }
  return blocks;
}
