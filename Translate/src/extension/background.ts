import { CLIENT_HEADER, CLIENT_VALUE, LOCAL_HOST, LOCAL_PORT, TRANSLATE_PATH } from "../shared/local-service.ts";
import { isTranslationBatch, readTranslations } from "../shared/translation.ts";
import type { TranslationReply } from "./messages.ts";

async function requestTranslation(blocks: unknown): Promise<TranslationReply> {
  if (!isTranslationBatch(blocks)) return { error: "待翻译段落格式有误。" };
  const signal = AbortSignal.timeout(28_000);
  try {
    const response = await fetch(`http://${LOCAL_HOST}:${LOCAL_PORT}${TRANSLATE_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [CLIENT_HEADER]: CLIENT_VALUE },
      body: JSON.stringify({ blocks }),
      redirect: "error",
      signal
    });
    const body = await response.json();
    if (!response.ok) {
      return { error: typeof body.error === "string" ? body.error : `本地服务返回 HTTP ${response.status}。` };
    }
    return { translations: readTranslations(body, blocks) };
  } catch (error) {
    if (signal.aborted) return { error: "本地翻译请求超时，请重试。" };
    if (error instanceof TypeError) return { error: "无法连接本地翻译服务，请确认 npm start 正在运行。" };
    return { error: error instanceof Error ? error.message : "翻译请求失败。" };
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== "translate-blocks" || sender.id !== chrome.runtime.id || !sender.tab) return;
  void requestTranslation(message.blocks).then(reply);
  return true;
});
