import { ChromaClient, Collection, IncludeEnum } from "chromadb";
import {
  PersistentVectorStore,
  TAddInput,
  TCollectionStats,
  TDocumentInput,
  TListOptions,
  TMemoryEntry,
  TMemoryMetadata,
  TSearchOptions,
  TSearchResult,
} from "./VectorStore";

export type TChromaVectorStoreOptions = {
  /** Chroma server URL. Default: http://localhost:8000 */
  url?: string;
  /** Collection name to use / create. */
  collectionName: string;
  /**
   * Distance metric for the collection.
   * "cosine" (default) | "l2" | "ip"
   */
  distanceMetric?: "cosine" | "l2" | "ip";
};

/**
 * Maps Chroma's raw distance to a normalised similarity score in [0, 1].
 *
 * Chroma returns *distance* (lower = more similar), so we invert it:
 *   cosine / ip  → distance ∈ [0, 2]  → score = 1 - distance / 2
 *   l2           → distance ∈ [0, ∞)  → score = 1 / (1 + distance)
 */
function distanceToScore(distance: number, metric: string): number {
  if (metric === "l2") {
    return 1 / (1 + distance);
  }
  // cosine or ip: distance in [0, 2]
  return Math.max(0, 1 - distance / 2);
}

export class ChromaVectorStore extends PersistentVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private initialized = false;

  private readonly url: string;
  private readonly collectionName: string;
  private readonly distanceMetric: "cosine" | "l2" | "ip";

  constructor(options: TChromaVectorStoreOptions) {
    super();
    this.url = options.url ?? "http://localhost:8000";
    this.collectionName = options.collectionName;
    this.distanceMetric = options.distanceMetric ?? "cosine";

    this.client = new ChromaClient({ path: this.url });
  }

  async initialize(): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { "hnsw:space": this.distanceMetric },
    });
    this.initialized = true;
  }

  async disconnect(): Promise<void> {
    // chromadb JS client is stateless HTTP — nothing to close.
    this.collection = null;
    this.initialized = false;
  }

  private get col(): Collection {
    this.ensureInitialized(this.initialized, "ChromaVectorStore");
    return this.collection!;
  }

  /**
   * Chroma stores metadata as a flat Record<string, string | number | boolean>.
   * We JSON-stringify nested objects so TMemoryMetadata round-trips correctly.
   */
  private serializeMetadata(
    metadata?: TMemoryMetadata,
    timestamp?: string,
  ): Record<string, string | number | boolean> {
    const flat: Record<string, string | number | boolean> = {
      __timestamp: timestamp ?? new Date().toISOString(),
    };
    if (!metadata) return flat;

    for (const [k, v] of Object.entries(metadata)) {
      flat[k] =
        typeof v === "object" && v !== null ? JSON.stringify(v) : (v as string | number | boolean);
    }
    return flat;
  }

  private deserializeMetadata(
    raw: Record<string, string | number | boolean> | null,
  ): { metadata: TMemoryMetadata; timestamp: string } {
    if (!raw) return { metadata: {} as TMemoryMetadata, timestamp: new Date().toISOString() };

    const { __timestamp, ...rest } = raw;
    const metadata: Record<string, any> = {};

    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === "string") {
        try {
          metadata[k] = JSON.parse(v);
        } catch {
          metadata[k] = v;
        }
      } else {
        metadata[k] = v;
      }
    }

    return {
      metadata: metadata as TMemoryMetadata,
      timestamp: String(__timestamp ?? new Date().toISOString()),
    };
  }

  async add(input: TAddInput): Promise<string> {
    const id = crypto.randomUUID();
    await this.col.add({
      ids: [id],
      embeddings: [input.embedding],
      documents: [input.text],
      metadatas: [this.serializeMetadata(input.metadata)],
    });
    return id;
  }

  async addDocument(input: TDocumentInput): Promise<string> {
    if (!input.embedding) {
      throw new Error(
        "ChromaVectorStore requires a pre-computed embedding on each document.",
      );
    }
    return this.add({
      text: input.pageContent,
      embedding: input.embedding,
      metadata: input.metadata,
    });
  }

  async addDocuments(inputs: TDocumentInput[]): Promise<string[]> {
    if (inputs.some((d) => !d.embedding)) {
      throw new Error(
        "ChromaVectorStore requires pre-computed embeddings on all documents.",
      );
    }

    const ids = inputs.map(() => crypto.randomUUID());
    await this.col.add({
      ids,
      embeddings: inputs.map((d) => d.embedding!),
      documents: inputs.map((d) => d.pageContent),
      metadatas: inputs.map((d) => this.serializeMetadata(d.metadata)),
    });
    return ids;
  }

  async upsert(id: string, input: TAddInput): Promise<void> {
    await this.col.upsert({
      ids: [id],
      embeddings: [input.embedding],
      documents: [input.text],
      metadatas: [this.serializeMetadata(input.metadata)],
    });
  }

  async getById(id: string): Promise<TMemoryEntry | null> {
    const result = await this.col.get({
      ids: [id],
      include: [IncludeEnum.documents, IncludeEnum.metadatas, IncludeEnum.embeddings],
    });

    if (!result.ids.length) return null;

    const { metadata, timestamp } = this.deserializeMetadata(
      result.metadatas?.[0] as Record<string, string | number | boolean> | null,
    );

    return this.buildEntry(
      result.ids[0],
      result.documents?.[0] ?? "",
      (result.embeddings?.[0] as number[]) ?? [],
      metadata,
      timestamp,
    );
  }

  async list(options?: TListOptions): Promise<TMemoryEntry[]> {
    const result = await this.col.get({
      limit: options?.limit,
      offset: options?.offset,
      where: options?.filter,
      include: [IncludeEnum.documents, IncludeEnum.metadatas, IncludeEnum.embeddings],
    });

    return result.ids.map((id, i) => {
      const { metadata, timestamp } = this.deserializeMetadata(
        result.metadatas?.[i] as Record<string, string | number | boolean> | null,
      );
      return this.buildEntry(
        id,
        result.documents?.[i] ?? "",
        (result.embeddings?.[i] as number[]) ?? [],
        metadata,
        timestamp,
      );
    });
  }

  async search(
    queryEmbedding: number[],
    options?: TSearchOptions,
  ): Promise<TSearchResult[]> {
    const topK = options?.topK ?? 10;
    const threshold = options?.threshold ?? 0;

    const includeFields: IncludeEnum[] = [
      IncludeEnum.documents,
      IncludeEnum.metadatas,
      IncludeEnum.distances,
    ];
    if (options?.includeEmbeddings) {
      includeFields.push(IncludeEnum.embeddings);
    }

    const result = await this.col.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: options?.filter,
      include: includeFields,
    });

    const ids = result.ids[0] ?? [];
    const documents = result.documents[0] ?? [];
    const metadatas = result.metadatas[0] ?? [];
    const distances = result.distances?.[0] ?? [];
    const embeddings = result.embeddings?.[0] ?? [];

    const results: TSearchResult[] = [];

    for (let i = 0; i < ids.length; i++) {
      const score = distanceToScore(distances[i] ?? 0, this.distanceMetric);
      if (score < threshold) continue;

      const { metadata, timestamp } = this.deserializeMetadata(
        metadatas[i] as Record<string, string | number | boolean> | null,
      );

      results.push({
        score,
        entry: this.buildEntry(
          ids[i],
          documents[i] ?? "",
          (embeddings[i] as number[]) ?? [],
          metadata,
          timestamp,
        ),
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Delete operations
  // ---------------------------------------------------------------------------

  async deleteByIds(ids: string[]): Promise<void> {
    await this.col.delete({ ids });
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    await this.col.delete({ where: filter });
  }

  async count(): Promise<number> {
    return this.col.count();
  }

  async getStats(): Promise<TCollectionStats> {
    const count = await this.col.count();
    const meta = this.col.metadata as Record<string, any> | undefined;

    return {
      documentCount: count,
      distanceMetric: this.distanceMetric,
      collectionName: this.collectionName,
      chromaMetadata: meta ?? {},
    };
  }

  async reset(): Promise<void> {
    await this.client.deleteCollection({ name: this.collectionName });
    await this.initialize();
  }
}