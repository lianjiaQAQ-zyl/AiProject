import type { TextBlock } from "../shared/translation.ts";

export type PageCommand =
  | { type: "translate" | "restore" | "status" }
  | { type: "original" | "translation"; visible: boolean };

export interface PageStatus {
  message: string;
  running: boolean;
  canRetry: boolean;
  showOriginal: boolean;
  showTranslation: boolean;
}

export type TranslationReply = { translations: TextBlock[] } | { error: string };
