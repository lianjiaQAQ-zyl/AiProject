import { CLIENT_HEADER, CLIENT_VALUE, LOCAL_HOST, LOCAL_PORT, TRANSLATE_PATH } from "../shared/local-service.ts";
import { readTranslations, type TextBlock } from "../shared/translation.ts";

export async function postToLocalService(
  path: string, body: string | Blob, contentType: string, timeout = 28_000
): Promise<unknown> {
  const signal = AbortSignal.timeout(timeout);
  try {
    const response = await fetch(`http://${LOCAL_HOST}:${LOCAL_PORT}${path}`, {
      method: "POST",
      headers: { "Content-Type": contentType, [CLIENT_HEADER]: CLIENT_VALUE },
      body,
      redirect: "error",
      signal
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(typeof result?.error === "string" ? result.error : `本地服务返回 HTTP ${response.status}。`);
    }
    return result;
  } catch (error) {
    if (signal.aborted) throw new Error("本地请求超时，请重试。");
    if (error instanceof TypeError) throw new Error("无法连接本地翻译服务，请确认 npm start 正在运行。");
    throw error;
  }
}

export async function translateBlocks(blocks: TextBlock[]) {
  const result = await postToLocalService(TRANSLATE_PATH, JSON.stringify({ blocks }), "application/json");
  return readTranslations(result, blocks);
}
