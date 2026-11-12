import { MAX_BATCH_CHARACTERS, type TextBlock } from "../shared/translation.ts";
import { collectInterfaceText } from "./interface-text.ts";
import { createVisibilityCheck } from "./page-visibility.ts";

const BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, dd, dt";
const CONTENT_REGION = "article, [role=article], .markdown-body";
const COMPACT_REGION = [
  "nav", "aside", "header", "footer", "form", "table", "summary", "button",
  "[role=navigation]", "[role=toolbar]", "[role=tablist]", "[role=menu]", "[role=button]",
  "[role=grid]", "[role=tree]"
].join(", ");
const MAX_PARAGRAPH_CHARACTERS = 16_000;

export interface PageBlock {
  target: HTMLElement | Text;
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

function isEnglish(text: string) {
  const latin = text.match(/[a-z]/gi)?.length ?? 0;
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  return /[a-z]{2}/i.test(text) && (han < 3 || latin >= han * 3);
}

function isProse(element: HTMLElement, source: string) {
  if (element.closest(COMPACT_REGION)) return false;
  if (element.closest(CONTENT_REGION)) return true;
  const parent = element.parentElement;
  if (parent && /flex|grid/.test(getComputedStyle(parent).display)) return false;
  return element.matches("p, blockquote, li") && element.offsetWidth >= 180 &&
    source.split(/\s+/).length >= 8;
}

export function collectPageBlocks(
  document: Document,
  readSource: (element: HTMLElement) => string,
  isTranslated: (element: HTMLElement, source: string) => boolean,
  isInterfaceTranslated: (node: Text) => boolean
) {
  const isVisible = createVisibilityCheck();
  const blocks: PageBlock[] = [];
  const prose = new Set<HTMLElement>();
  let id = 1;
  function add(target: HTMLElement | Text, source: string) {
    if (!isEnglish(source) || source.length > MAX_PARAGRAPH_CHARACTERS) return;
    blocks.push({ target, source, parts: splitText(source).map(text => ({ id: id++, text })) });
  }

  for (const element of document.body.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (!isVisible(element) || element.querySelector(`${BLOCK_SELECTOR}, pre, button, input, select, textarea`) ||
        element.offsetWidth < 3 || element.offsetHeight < 3) continue;
    const source = readSource(element);
    if (!isProse(element, source)) continue;
    prose.add(element);
    if (!isTranslated(element, source)) add(element, source);
  }

  for (const node of collectInterfaceText(document, prose, isVisible)) {
    if (!isInterfaceTranslated(node)) add(node, node.data.trim());
  }
  return blocks;
}
