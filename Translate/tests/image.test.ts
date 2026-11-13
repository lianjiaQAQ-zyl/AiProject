import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createTranslationServer } from "../src/server/http.ts";

test("the OCR endpoint accepts PNG data and does not call the translation provider", async t => {
  const image = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  let recognized = 0;
  const server = createTranslationServer(async () => {
    assert.fail("图片不得发给翻译供应商。");
  }, async bytes => {
    assert.deepEqual(bytes, image);
    recognized++;
    return ["Reset password"];
  });
  t.after(() => server.close());
  await once(server.listen(0, "127.0.0.1"), "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const send = (body: Uint8Array, contentType = "image/png") =>
    fetch(`http://127.0.0.1:${address.port}/recognize-image`, {
      method: "POST",
      headers: { "Content-Type": contentType, "X-Translate-Client": "chrome-extension" },
      body: new Blob([Uint8Array.from(body)])
    });
  assert.equal((await send(image, "text/plain")).status, 415);
  assert.equal((await send(new Uint8Array([1, 2, 3]))).status, 400);
  assert.deepEqual(await (await send(image)).json(), { lines: ["Reset password"] });
  assert.equal(recognized, 1);
});
