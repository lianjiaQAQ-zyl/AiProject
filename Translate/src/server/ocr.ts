import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const defaultExecutable = fileURLToPath(new URL("./recognize-image", import.meta.url));

export function recognizeImage(image: Buffer, executable = defaultExecutable): Promise<string[]> {
  if (process.platform !== "darwin") {
    return Promise.reject(new Error("图片文字识别目前仅支持 macOS。"));
  }

  return new Promise((resolve, reject) => {
    const worker = execFile(executable, { timeout: 30_000, maxBuffer: 128 * 1024 }, (error, stdout) => {
      if (error) {
        const message = error.code === "ENOENT" ? "请先运行 npm run build:ocr。" :
          error.killed ? "图片文字识别超时，请试试较小的图片。" : "无法识别图片，请确认图片可以正常打开。";
        reject(new Error(message));
        return;
      }
      try {
        const lines: unknown = JSON.parse(stdout);
        if (!Array.isArray(lines) || !lines.every(line => typeof line === "string")) {
          throw new Error("识别结果格式有误。");
        }
        resolve(lines);
      } catch {
        reject(new Error("无法读取图片识别结果。"));
      }
    });
    worker.stdin?.on("error", () => undefined);
    worker.stdin?.end(image);
  });
}
