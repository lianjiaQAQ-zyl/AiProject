export interface TextBlock {
  id: number;
  text: string;
}

export const MAX_BATCH_CHARACTERS = 3200;
const MAX_BATCH_BLOCKS = 12;

export function splitTranslationText(text: string): string[] {
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

export function batchBlocks<T extends TextBlock>(blocks: readonly T[]): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let characters = 0;
  for (const block of blocks) {
    if (batch.length === MAX_BATCH_BLOCKS || characters + block.text.length > MAX_BATCH_CHARACTERS) {
      if (batch.length) batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(block);
    characters += block.text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function isTextBlock(value: unknown): value is TextBlock {
  if (!value || typeof value !== "object") return false;
  const { id, text } = value as Partial<TextBlock>;
  return typeof id === "number" && Number.isSafeInteger(id) && id >= 0 &&
    typeof text === "string" && text.trim().length > 0;
}

export function isTranslationBatch(value: unknown): value is TextBlock[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_BATCH_BLOCKS &&
    value.every(isTextBlock) && new Set(value.map(block => block.id)).size === value.length &&
    value.reduce((total, block) => total + block.text.length, 0) <= MAX_BATCH_CHARACTERS;
}

export function readTranslations(value: unknown, blocks: readonly TextBlock[]): TextBlock[] {
  const translations = (value as { translations?: unknown } | null)?.translations;
  if (!Array.isArray(translations) || translations.length !== blocks.length ||
      !translations.every(isTextBlock)) {
    throw new Error("译文数量或格式有误。");
  }
  const byId = new Map(translations.map(block => [block.id, block]));
  return blocks.map(({ id }) => {
    const translation = byId.get(id);
    if (!translation) throw new Error("译文编号与原文不匹配。");
    return translation;
  });
}
