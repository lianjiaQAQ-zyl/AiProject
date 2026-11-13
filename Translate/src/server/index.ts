import { LOCAL_HOST, LOCAL_PORT } from "../shared/local-service.ts";
import { createDeepSeekTranslator } from "./deepseek.ts";
import { recognizeImage } from "./ocr.ts";
import { createTranslationServer } from "./http.ts";

const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  console.error("请在 .env 或终端环境变量中设置 DEEPSEEK_API_KEY。");
  process.exit(1);
}

const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
const server = createTranslationServer(createDeepSeekTranslator(apiKey, model), recognizeImage);
server.on("error", error => {
  console.error(`无法启动本地翻译服务：${error.message}`);
  process.exitCode = 1;
});
server.listen(LOCAL_PORT, LOCAL_HOST, () => {
  console.log(`本地翻译服务已启动：http://${LOCAL_HOST}:${LOCAL_PORT}（${model}）`);
});
