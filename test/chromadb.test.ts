/**
 * ChromaVectorStore — test suite (node:test)
 *
 * Run:
 *   npx ts-node ./test/chromadb.test.ts
 *
 * Requirements:
 *   - Chroma running: docker run -p 8000:8000 chromadb/chroma
 *   - npm i chromadb
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { ChromaVectorStore } from "../src/vector-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a normalised unit vector of given dims, shifted by `phase`. */
function makeVector(dims: number, phase = 0): number[] {
  const v = Array.from({ length: dims }, (_, i) => Math.sin(i + phase));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

const DIMS = 8;
const COLLECTION = `test_chroma_${Date.now()}`;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("ChromaVectorStore", async () => {
  const store = new ChromaVectorStore({
    collectionName: COLLECTION,
    url: "http://localhost:8000",
    distanceMetric: "cosine",
  });

  // IDs shared across tests
  let idA: string;
  let idB: string;
  let idC: string;
  let bulkIds: string[];

  // ── 0. ping before init ─────────────────────────────────────────────────
  describe("0 · ping before initialize", () => {
    it("returns ok=false before initialize()", async () => {
      const result = await store.ping();
      assert.equal(result.ok, false);
    });
  });

  // ── 1. initialize ────────────────────────────────────────────────────────
  describe("1 · initialize", () => {
    before(async () => {
      await store.initialize();
    });

    it("ping returns ok=true after initialize()", async () => {
      const result = await store.ping();
      assert.equal(result.ok, true);
    });

    it("fresh collection starts empty", async () => {
      assert.equal(await store.count(), 0);
    });
  });

  // ── 2. add + getById ─────────────────────────────────────────────────────
  describe("2 · add + getById", () => {
    before(async () => {
      idA = await store.add({
        text: "The quick brown fox",
        embedding: makeVector(DIMS, 0),
        metadata: { topic: "animals" },
      });

      idB = await store.add({
        text: "AWS Bedrock is a managed AI service",
        embedding: makeVector(DIMS, Math.PI),
        metadata: { topic: "aws" },
      });
    });

    it("add() returns a non-empty string ID", () => {
      assert.equal(typeof idA, "string");
      assert.ok(idA.length > 0);
    });

    it("getById() finds the entry", async () => {
      const entry = await store.getById(idA);
      assert.notEqual(entry, null);
    });

    it("returned entry has correct id and text", async () => {
      const entry = await store.getById(idA);
      assert.equal(entry!.id, idA);
      assert.equal(entry!.text, "The quick brown fox");
    });

    it("metadata.topic round-trips correctly", async () => {
      const entry = await store.getById(idA);
      assert.equal(entry!.metadata?.topic, "animals");
    });

    it("timestamp is present", async () => {
      const entry = await store.getById(idA);
      assert.equal(typeof entry!.timestamp, "string");
      assert.ok(entry!.timestamp.length > 0);
    });

    it("count() reflects two documents", async () => {
      assert.equal(await store.count(), 2);
    });
  });

  // ── 3. addDocument ───────────────────────────────────────────────────────
  describe("3 · addDocument", () => {
    before(async () => {
      idC = await store.addDocument({
        pageContent: "LangChain.js orchestrates LLM workflows",
        embedding: makeVector(DIMS, 1),
        metadata: { topic: "ai" },
      });
    });

    it("addDocument() returns a string ID", () => {
      assert.equal(typeof idC, "string");
      assert.ok(idC.length > 0);
    });

    it("pageContent is stored as text", async () => {
      const entry = await store.getById(idC);
      assert.equal(entry!.text, "LangChain.js orchestrates LLM workflows");
    });

    it("throws when embedding is missing", async () => {
      await assert.rejects(
        () => store.addDocument({ pageContent: "no embedding here" }),
        /pre-computed embedding/,
      );
    });
  });

  // ── 4. addDocuments (bulk) ───────────────────────────────────────────────
  describe("4 · addDocuments", () => {
    before(async () => {
      bulkIds = await store.addDocuments([
        {
          pageContent: "Vietnam is in Southeast Asia",
          embedding: makeVector(DIMS, 2),
          metadata: { topic: "geography" },
        },
        {
          pageContent: "Hoang Sa and Truong Sa belong to Vietnam",
          embedding: makeVector(DIMS, 3),
          metadata: { topic: "geography" },
        },
        {
          pageContent: "Tuan is a Fullstack Developer",
          embedding: makeVector(DIMS, 4),
          metadata: { topic: "personal" },
        },
      ]);
    });

    it("returns 3 IDs", () => {
      assert.equal(bulkIds.length, 3);
    });

    it("IDs are unique", () => {
      assert.equal(new Set(bulkIds).size, 3);
    });

    it("count() is 6 after bulk insert", async () => {
      assert.equal(await store.count(), 6);
    });
  });

  // ── 5. upsert ────────────────────────────────────────────────────────────
  describe("5 · upsert", () => {
    before(async () => {
      await store.upsert(idA, {
        text: "The quick brown fox — updated",
        embedding: makeVector(DIMS, 0),
        metadata: { topic: "animals", version: "updated" },
      });
    });

    it("overwrites text", async () => {
      const entry = await store.getById(idA);
      assert.equal(entry!.text, "The quick brown fox — updated");
    });

    it("overwrites metadata", async () => {
      const entry = await store.getById(idA);
      assert.equal(entry!.metadata?.version, "updated");
    });

    it("does not increase count", async () => {
      assert.equal(await store.count(), 6);
    });
  });

  // ── 6. list ──────────────────────────────────────────────────────────────
  describe("6 · list", () => {
    it("returns all 6 entries without options", async () => {
      const all = await store.list();
      assert.equal(all.length, 6);
    });

    it("list({ limit: 2 }) returns 2 entries", async () => {
      const limited = await store.list({ limit: 2 });
      assert.equal(limited.length, 2);
    });

    it("paginated pages do not overlap", async () => {
      const page1 = await store.list({ limit: 2, offset: 0 });
      const page2 = await store.list({ limit: 2, offset: 2 });
      const ids1 = new Set(page1.map((e) => e.id));
      const overlap = page2.filter((e) => ids1.has(e.id));
      assert.equal(overlap.length, 0);
    });

    it("metadata filter returns correct entries", async () => {
      const filtered = await store.list({ filter: { topic: "aws" } });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].metadata?.topic, "aws");
    });

    it("metadata filter returns multiple matching entries", async () => {
      const filtered = await store.list({ filter: { topic: "geography" } });
      assert.equal(filtered.length, 2);
      assert.ok(filtered.every((e) => e.metadata?.topic === "geography"));
    });
  });

  // ── 7. search ────────────────────────────────────────────────────────────
  describe("7 · search", () => {
    it("returns topK results", async () => {
      const results = await store.search(makeVector(DIMS, 1), { topK: 3 });
      assert.equal(results.length, 3);
    });

    it("most similar doc ranks first", async () => {
      const results = await store.search(makeVector(DIMS, 1), { topK: 3 });
      assert.equal(results[0].entry.id, idC);
    });

    it("results are sorted by score descending", async () => {
      const results = await store.search(makeVector(DIMS, 1), { topK: 3 });
      for (let i = 1; i < results.length; i++) {
        assert.ok(results[i - 1].score >= results[i].score);
      }
    });

    it("all scores are in [0, 1]", async () => {
      const results = await store.search(makeVector(DIMS, 1), { topK: 6 });
      for (const r of results) {
        assert.ok(
          r.score >= 0 && r.score <= 1,
          `score out of range: ${r.score}`,
        );
      }
    });

    it("exact-vector match score ≈ 1.0", async () => {
      const results = await store.search(makeVector(DIMS, 1), { topK: 1 });
      assert.ok(
        Math.abs(results[0].score - 1.0) < 0.01,
        `expected ≈1.0, got ${results[0].score}`,
      );
    });

    it("threshold filters out low-score results", async () => {
      const results = await store.search(makeVector(DIMS, 1), {
        topK: 6,
        threshold: 0.99,
      });
      assert.ok(results.length >= 1);
      for (const r of results) {
        assert.ok(r.score >= 0.99, `score ${r.score} below threshold`);
      }
    });

    it("metadata filter narrows search results", async () => {
      const results = await store.search(makeVector(DIMS, 2), {
        topK: 6,
        filter: { topic: "geography" },
      });
      assert.ok(results.length >= 1);
      assert.ok(results.every((r) => r.entry.metadata?.topic === "geography"));
    });

    it("includeEmbeddings=true returns embedding vector", async () => {
      const results = await store.search(makeVector(DIMS, 1), {
        topK: 1,
        includeEmbeddings: true,
      });
      assert.ok(Array.isArray(results[0].entry.embedding));
      assert.equal(results[0].entry.embedding.length, DIMS);
    });

    it("includeEmbeddings=false omits embedding", async () => {
      const results = await store.search(makeVector(DIMS, 1), {
        topK: 1,
        includeEmbeddings: false,
      });
      assert.equal(results[0].entry.embedding.length, 0);
    });
  });

  // ── 8. getStats ──────────────────────────────────────────────────────────
  describe("8 · getStats", () => {
    it("documentCount is correct", async () => {
      const stats = await store.getStats();
      assert.equal(stats.documentCount, 6);
    });

    it("distanceMetric is cosine", async () => {
      const stats = await store.getStats();
      assert.equal(stats.distanceMetric, "cosine");
    });

    it("collectionName is correct", async () => {
      const stats = await store.getStats();
      assert.equal(stats.collectionName, COLLECTION);
    });
  });

  // ── 9. deleteByIds ───────────────────────────────────────────────────────
  describe("9 · deleteByIds", () => {
    before(async () => {
      await store.deleteByIds([idB]);
    });

    it("removes the entry", async () => {
      const entry = await store.getById(idB);
      assert.equal(entry, null);
    });

    it("count() decreases after delete", async () => {
      assert.equal(await store.count(), 5);
    });
  });

  // ── 10. deleteByFilter ───────────────────────────────────────────────────
  describe("10 · deleteByFilter", () => {
    before(async () => {
      await store.deleteByFilter({ topic: "geography" });
    });

    it("removes all matching entries", async () => {
      const remaining = await store.list({ filter: { topic: "geography" } });
      assert.equal(remaining.length, 0);
    });

    it("count() correct after filter delete", async () => {
      assert.equal(await store.count(), 3);
    });
  });

  // ── 11. hybridSearch (dense fallback) ────────────────────────────────────
  describe("11 · hybridSearch (dense fallback)", () => {
    it("returns at most topK results", async () => {
      const results = await store.hybridSearch(
        "LangChain orchestration",
        makeVector(DIMS, 1),
        { topK: 2 },
      );
      assert.ok(results.length <= 2);
    });

    it("ranks idC first via dense fallback", async () => {
      const results = await store.hybridSearch(
        "LangChain orchestration",
        makeVector(DIMS, 1),
        { topK: 3 },
      );
      assert.equal(results[0].entry.id, idC);
    });
  });

  // ── 12. reset ────────────────────────────────────────────────────────────
  describe("12 · reset", () => {
    before(async () => {
      await store.reset();
    });

    it("wipes the collection", async () => {
      assert.equal(await store.count(), 0);
    });
  });

  // ── 13. disconnect ───────────────────────────────────────────────────────
  describe("13 · disconnect", () => {
    before(async () => {
      await store.disconnect();
    });

    it("throws when calling count() after disconnect()", async () => {
      await assert.rejects(() => store.count());
    });
  });

  // ── Cleanup: xóa collection test khỏi Chroma ────────────────────────────
  after(async () => {
    try {
      await store.initialize();
      await store.reset();
      await store.disconnect();
    } catch {
      // best-effort
    }
  });
});
