import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { CLIENT_HEADER, CLIENT_VALUE, MAX_IMAGE_BYTES, RECOGNIZE_IMAGE_PATH, TRANSLATE_PATH } from "../shared/local-service.ts";
import { isTranslationBatch, type TextBlock } from "../shared/translation.ts";

const MAX_BODY_BYTES = 32 * 1024;
type Translator = (blocks: TextBlock[]) => Promise<TextBlock[]>;
type Recognizer = (image: Buffer) => Promise<string[]>;
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      request.resume();
      throw new RequestError(413, "请求内容过大。");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readTranslationBatch(request: IncomingMessage) {
  const raw = await readBody(request, MAX_BODY_BYTES);
  let body: { blocks?: unknown } | null;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new RequestError(400, "请求需要有效的 JSON。");
  }
  if (!isTranslationBatch(body?.blocks)) throw new RequestError(400, "待翻译段落格式或大小有误。");
  return body.blocks;
}

async function readImage(request: IncomingMessage) {
  const image = await readBody(request, MAX_IMAGE_BYTES);
  if (!image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new RequestError(400, "图片内容需要有效的 PNG 格式。");
  }
  return image;
}

function sendJson(response: ServerResponse, status: number, body: object) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  translate: Translator,
  recognize?: Recognizer
) {
  try {
    const isImage = request.url === RECOGNIZE_IMAGE_PATH;
    if (request.method !== "POST" || (!isImage && request.url !== TRANSLATE_PATH)) {
      throw new RequestError(404, "未找到此接口。");
    }
    const origin = request.headers.origin;
    if (request.headers[CLIENT_HEADER.toLowerCase()] !== CLIENT_VALUE ||
        (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))) {
      throw new RequestError(403, "本地翻译接口仅接受扩展请求。");
    }
    const contentType = isImage ? "image/png" : "application/json";
    if (request.headers["content-type"]?.split(";")[0] !== contentType) {
      throw new RequestError(415, isImage ? "请求需要 PNG 图片。" : "请求需要 JSON 格式。");
    }
    if (isImage) {
      if (!recognize) throw new RequestError(501, "本地图片识别不可用。");
      sendJson(response, 200, { lines: await recognize(await readImage(request)) });
    } else {
      sendJson(response, 200, { translations: await translate(await readTranslationBatch(request)) });
    }
  } catch (error) {
    if (error instanceof RequestError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    sendJson(response, 502, { error: error instanceof Error ? error.message : "翻译请求失败。" });
  }
}

export function createTranslationServer(translate: Translator, recognize?: Recognizer) {
  return createServer((request, response) => void handleRequest(request, response, translate, recognize));
}
