import fs from "fs";
import crypto from "crypto";

import { TOP_K_MEMORIES, SIMILARITY_THRESHOLD } from "../config";
import { VectorStore } from "./VectorStore";

import type {
  TMemoryEntry,
  TMemoryMetadata,
  TAddInput,
  TDocumentInput,
  TListOptions,
  TSearchOptions,
  TSearchResult,
  TCollectionStats,
} from "./VectorStore";

export class LocalFileVectorStore extends VectorStore {
  private store = new Map<string, TMemoryEntry>();
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    this._loadFromDisk();
  }

  async saveSnapshot(path: string): Promise<void> {
    const entries = [...this.store.values()];
    fs.writeFileSync(path, JSON.stringify(entries, null, 2), "utf-8");
  }

  async loadSnapshot(path: string): Promise<void> {
    this.store.clear();
    const entries: TMemoryEntry[] = JSON.parse(fs.readFileSync(path, "utf-8"));
    entries.forEach((e) => this.store.set(e.id, e));
    console.log(`  📂 Loaded ${this.store.size} entries from ${path}`);
  }

  private _loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const entries: TMemoryEntry[] = JSON.parse(
          fs.readFileSync(this.filePath, "utf-8"),
        );
        entries.forEach((e) => this.store.set(e.id, e));
        console.log(`  📂 Loaded ${this.store.size} memories from disk`);
      }
    } catch {
      console.log("  ⚠️  Could not load memory file, starting fresh");
      this.store.clear();
    }
  }

  private _saveToDisk(): void {
    fs.writeFileSync(
      this.filePath,
      JSON.stringify([...this.store.values()], null, 2),
      "utf-8",
    );
  }

  private _generateId(): string {
    return `mem_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  }

  private _cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /** Apply a flat metadata filter (AND semantics). */
  private _matchesFilter(
    entry: TMemoryEntry,
    filter?: Record<string, any>,
  ): boolean {
    if (!filter) return true;
    return Object.entries(filter).every(([k, v]) => entry.metadata?.[k] === v);
  }

  async add(input: TAddInput): Promise<string> {
    const entry = this.buildEntry(
      this._generateId(),
      input.text,
      input.embedding,
      input.metadata,
    );
    this.store.set(entry.id, entry);
    this._saveToDisk();
    return entry.id;
  }

  async addDocument(input: TDocumentInput): Promise<string> {
    if (!input.embedding) {
      throw new Error(
        "LocalFileVectorStore.addDocument: embedding is required (no built-in embedder).",
      );
    }
    return this.add({
      text: input.pageContent,
      embedding: input.embedding,
      metadata: input.metadata,
    });
  }

  async addDocuments(inputs: TDocumentInput[]): Promise<string[]> {
    const ids = await Promise.all(inputs.map((d) => this.addDocument(d)));
    // addDocument() calls _saveToDisk() each time — do one final consolidated save
    this._saveToDisk();
    return ids;
  }

  async upsert(id: string, input: TAddInput): Promise<void> {
    const existing = this.store.get(id);
    const entry = this.buildEntry(
      id,
      input.text,
      input.embedding,
      input.metadata,
      existing?.timestamp, // preserve original timestamp if updating
    );
    this.store.set(id, entry);
    this._saveToDisk();
  }

  async getById(id: string): Promise<TMemoryEntry | null> {
    return this.store.get(id) ?? null;
  }

  async list(options?: TListOptions): Promise<TMemoryEntry[]> {
    const { limit, offset = 0, filter } = options ?? {};

    let entries = [...this.store.values()].filter((e) =>
      this._matchesFilter(e, filter),
    );

    if (offset) entries = entries.slice(offset);
    if (limit) entries = entries.slice(0, limit);

    return entries;
  }

  async search(
    queryEmbedding: number[],
    options?: TSearchOptions,
  ): Promise<TSearchResult[]> {
    const {
      topK = TOP_K_MEMORIES,
      threshold = SIMILARITY_THRESHOLD,
      filter,
      includeEmbeddings = false,
    } = options ?? {};

    return [...this.store.values()]
      .filter((e) => this._matchesFilter(e, filter))
      .map((entry) => ({
        entry: includeEmbeddings ? entry : { ...entry, embedding: [] },
        score: this._cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    ids.forEach((id) => this.store.delete(id));
    this._saveToDisk();
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    for (const [id, entry] of this.store.entries()) {
      if (this._matchesFilter(entry, filter)) this.store.delete(id);
    }
    this._saveToDisk();
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async getStats(): Promise<TCollectionStats> {
    const first = this.store.values().next().value as TMemoryEntry | undefined;
    return {
      documentCount: this.store.size,
      dimensions: first?.embedding.length,
      distanceMetric: "cosine",
      filePath: this.filePath,
    };
  }

  async reset(): Promise<void> {
    this.store.clear();
    this._saveToDisk();
  }
}
