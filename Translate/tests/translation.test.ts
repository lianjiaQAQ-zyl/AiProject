import assert from "node:assert/strict";
import test from "node:test";
import { batchBlocks, isTranslationBatch, readTranslations } from "../src/shared/translation.ts";
import { createDeepSeekTranslator } from "../src/server/deepseek.ts";
import { createTranslationServer } from "../src/server/http.ts";

const blocks = [{ id: 1, text: "Hello" }, { id: 2, text: "World" }];
const translations = [{ id: 1, text: "你好" }, { id: 2, text: "世界" }];

test("batching preserves order and limits both characters and paragraph count", () => {
  const paragraphs = Array.from({ length: 14 }, (_, id) => ({ id, text: "abc" }));
  paragraphs[0].text = "x".repeat(3199);
  const batches = batchBlocks(paragraphs);
  assert.deepEqual(batches.map(batch => batch.length), [1, 12, 1]);
  assert.deepEqual(batches.flat(), paragraphs);
  assert.ok(batches.every(isTranslationBatch));
});

test("batch validation rejects duplicate IDs and oversized requests", () => {
  assert.equal(isTranslationBatch([blocks[0], blocks[0]]), false);
  assert.equal(isTranslationBatch([{ id: 1, text: "x".repeat(3201) }]), false);
  assert.equal(isTranslationBatch([{ id: 1, text: " " }]), false);
});

test("translations match by ID and reject missing, unexpected, duplicate or blank results", () => {
  assert.deepEqual(readTranslations({ translations: translations.toReversed() }, blocks), translations);
  for (const bad of [translations.slice(0, 1), [translations[0], translations[0]],
    [translations[0], { id: 3, text: "世界" }], [translations[0], { id: 2, text: " " }]]) {
    assert.throws(() => readTranslations({ translations: bad }, blocks), /译文/);
  }
});

test("DeepSeek request sends numbered text and validates JSON response", async () => {
  const translate = createDeepSeekTranslator("test-key", "test-model", async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer test-key");
    assert.equal(options?.redirect, "error");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "test-model");
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.deepEqual(JSON.parse(body.messages[1].content), blocks);
    return Response.json({ choices: [{ finish_reason: "stop", message: {
      content: JSON.stringify({ translations: translations.toReversed() })
    } }] });
  });
  assert.deepEqual(await translate(blocks), translations);
});

test("DeepSeek rejects empty and truncated completions", async () => {
  for (const finish_reason of ["stop", "length"]) {
    const translate = createDeepSeekTranslator("test-key", "test-model", async () =>
      Response.json({ choices: [{ finish_reason, message: { content: " " } }] })
    );
    await assert.rejects(translate(blocks), /DeepSeek/);
  }
});

test("local server validates requests before calling the provider", async () => {
  let calls = 0;
  const server = createTranslationServer(async () => {
    calls++;
    return translations;
  });
  const respond = new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address !== "string") resolve(address.port);
    });
  });
  try {
    const url = `http://127.0.0.1:${await respond}/translate`;
    const headers = { "Content-Type": "application/json", "X-Translate-Client": "chrome-extension" };
    const send = (body: unknown, extra = {}) => fetch(url, {
      method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body)
    });
    assert.equal((await send({ blocks }, { Origin: "https://example.com" })).status, 403);
    assert.equal((await send({ blocks }, { "X-Translate-Client": "" })).status, 403);
    assert.equal((await send({ blocks: [blocks[0], blocks[0]] })).status, 400);
    assert.equal((await send({ blocks: "x".repeat(33000) })).status, 413);
    assert.deepEqual(await (await send({ blocks })).json(), { translations });
    assert.equal(calls, 1);
  } finally {
    server.close();
  }
});
