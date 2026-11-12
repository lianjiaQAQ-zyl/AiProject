const MIN_TEXT_SIZE = 3;

export function getTextBounds(node: Text) {
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  const rows: DOMRect[] = [];
  for (const rect of range.getClientRects()) {
    const center = (rect.top + rect.bottom) / 2;
    if (!rows.some(row => center >= row.top && center <= row.bottom)) rows.push(rect);
  }
  return { bounds: range.getBoundingClientRect(), lines: rows.length };
}

export function collectInterfaceText(
  document: Document,
  prose: ReadonlySet<HTMLElement>,
  isVisible: (element: Element) => boolean
) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (!parent || !/[a-z]{2}/i.test(node.data) || !isVisible(parent)) continue;
    let insideProse = false;
    for (let ancestor: HTMLElement | null = parent; ancestor; ancestor = ancestor.parentElement) {
      if (prose.has(ancestor)) {
        insideProse = true;
        break;
      }
    }
    if (insideProse) continue;
    const { bounds } = getTextBounds(node);
    if (bounds.width < MIN_TEXT_SIZE || bounds.height < MIN_TEXT_SIZE ||
        bounds.right <= 0 || bounds.left >= document.documentElement.clientWidth || bounds.bottom <= 0) continue;
    nodes.push(node);
  }
  return nodes;
}
