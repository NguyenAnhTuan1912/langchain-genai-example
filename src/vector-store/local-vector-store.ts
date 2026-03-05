import fs from "fs";

// Import config
import { TOP_K_MEMORIES, SIMILARITY_THRESHOLD } from "../config";

import { VectorStore, TMemoryEntry } from "./VectorStore";

export class LocalVectorStore extends VectorStore {
  private memories: TMemoryEntry[] = [];
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    this.load();
  }

  // Load từ disk
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        this.memories = JSON.parse(data);
        console.log(`  📂 Loaded ${this.memories.length} memories from disk`);
      }
    } catch (err) {
      console.log("  ⚠️  Could not load memory file, starting fresh");
      this.memories = [];
    }
  }

  // Persist to disk
  private save(): void {
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(this.memories, null, 2),
      "utf-8"
    );
  }

  // Cosine similarity
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Thêm memory mới
  async add(
    text: string,
    embedding: number[],
    metadata?: TMemoryEntry["metadata"]
  ): Promise<void> {
    const entry: TMemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      embedding,
      timestamp: new Date().toISOString(),
      metadata,
    };
    this.memories.push(entry);
    this.save();
  }

  // Search by similarity
  search(
    queryEmbedding: number[],
    topK: number = TOP_K_MEMORIES,
    threshold: number = SIMILARITY_THRESHOLD
  ): { entry: TMemoryEntry; score: number }[] {
    const scored = this.memories
      .map((entry) => ({
        entry,
        score: this.cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  // Lấy toàn bộ memories (cho debug)
  getAll(): TMemoryEntry[] {
    return this.memories;
  }

  // Xóa toàn bộ
  clear(): void {
    this.memories = [];
    this.save();
  }

  get size(): number {
    return this.memories.length;
  }
}