import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { CLIENT_HEADER, CLIENT_VALUE, TRANSLATE_PATH } from "../shared/local-service.ts";
import { isTranslationBatch, type TextBlock } from "../shared/translation.ts";

const MAX_BODY_BYTES = 32 * 1024;
type Translator = (blocks: TextBlock[]) => Promise<TextBlock[]>;

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      request.resume();
      throw new RequestError(413, "请求内容过大。");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "请求需要有效的 JSON。");
  }
}

function sendJson(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, translate: Translator) {
  try {
    if (request.method !== "POST" || request.url !== TRANSLATE_PATH) {
      throw new RequestError(404, "未找到此接口。");
    }
    const origin = request.headers.origin;
    if (request.headers[CLIENT_HEADER.toLowerCase()] !== CLIENT_VALUE ||
        (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))) {
      throw new RequestError(403, "本地翻译接口仅接受扩展请求。");
    }
    if (request.headers["content-type"]?.split(";")[0] !== "application/json") {
      throw new RequestError(415, "请求需要 JSON 格式。");
    }
    const body = await readBody(request) as { blocks?: unknown } | null;
    if (!isTranslationBatch(body?.blocks)) throw new RequestError(400, "待翻译段落格式或大小有误。");
    sendJson(response, 200, { translations: await translate(body.blocks) });
  } catch (error) {
    if (error instanceof RequestError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    sendJson(response, 502, { error: error instanceof Error ? error.message : "翻译请求失败。" });
  }
}

export function createTranslationServer(translate: Translator) {
  return createServer((request, response) => void handleRequest(request, response, translate));
}
