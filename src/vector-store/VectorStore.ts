export type TMemoryMetadata = Record<string, any>;

export type TMemoryEntry = {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  metadata?: TMemoryMetadata;
};

export type TAddInput = {
  text: string;
  embedding: number[];
  metadata?: TMemoryMetadata;
};

export type TDocumentInput = {
  pageContent: string;
  metadata?: TMemoryMetadata;
  /** Pre-computed embedding. Required if the store has no built-in embedder. */
  embedding?: number[];
};

export type TListOptions = {
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
};

export type TSearchOptions = {
  topK?: number;
  /** Minimum similarity score [0, 1] to include in results (default: 0). */
  threshold?: number;
  /** Provider-specific metadata filter (e.g. { topic: "finance" }). */
  filter?: Record<string, any>;
  /** Whether to include the raw embedding vector in results (default: false). */
  includeEmbeddings?: boolean;
};

export type TSearchResult = {
  entry: TMemoryEntry;
  /** Normalised similarity score in [0, 1]. Higher = more similar. */
  score: number;
};

export type TCollectionStats = {
  documentCount: number;
  /** Vector dimensions, if the provider exposes it. */
  dimensions?: number;
  /** e.g. "cosine" | "l2" | "ip" */
  distanceMetric?: string;
  /** Any extra provider-specific info. */
  [key: string]: any;
};

// Every provider must implement these, regardless of local or remote.

export abstract class VectorStore {
  /** Add a single entry with a pre-computed embedding. Returns generated ID. */
  abstract add(input: TAddInput): Promise<string>;

  /** Add a single document. Returns generated ID. */
  abstract addDocument(input: TDocumentInput): Promise<string>;

  /**
   * Bulk-add documents. Should be atomic where the provider supports it.
   * Returns generated IDs in the same order as input.
   */
  abstract addDocuments(inputs: TDocumentInput[]): Promise<string[]>;

  /** Insert or overwrite an entry by ID. */
  abstract upsert(id: string, input: TAddInput): Promise<void>;

  /** Fetch a single entry by ID. Returns null if not found. */
  abstract getById(id: string): Promise<TMemoryEntry | null>;

  /** List stored entries with optional pagination and metadata filter. */
  abstract list(options?: TListOptions): Promise<TMemoryEntry[]>;

  /**
   * Dense vector similarity search.
   * Returns results sorted by score descending, filtered by threshold.
   */
  abstract search(
    queryEmbedding: number[],
    options?: TSearchOptions,
  ): Promise<TSearchResult[]>;

  /** Delete entries by their IDs. */
  abstract deleteByIds(ids: string[]): Promise<void>;

  /** Delete all entries matching a metadata filter. */
  abstract deleteByFilter(filter: Record<string, any>): Promise<void>;

  /** Total number of documents stored. */
  abstract count(): Promise<number>;

  /** Provider-specific collection stats (count, dimensions, metric…). */
  abstract getStats(): Promise<TCollectionStats>;

  /** Wipe all data and recreate the collection from scratch. */
  abstract reset(): Promise<void>;

  /** Verify the store is reachable and operational. */
  async ping(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.count();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /**
   * Guard: throw if `initialize()` hasn't been called.
   * Call this at the top of each method for explicit lifecycle enforcement.
   */
  protected ensureInitialized(initialized: boolean, storeName: string): void {
    if (!initialized) {
      throw new Error(
        `${storeName} is not initialized. Call initialize() first.`,
      );
    }
  }

  /**
   * Assemble a TMemoryEntry from raw parts.
   * Saves subclasses from repeating the same construction logic.
   */
  protected buildEntry(
    id: string,
    text: string,
    embedding: number[],
    metadata?: TMemoryMetadata,
    timestamp?: string,
  ): TMemoryEntry {
    return {
      id,
      text,
      embedding,
      timestamp: timestamp ?? new Date().toISOString(),
      metadata,
    };
  }
}

// For remote / server-backed stores: Chroma, Qdrant, Pinecone, OpenSearch…
// Adds connection lifecycle and optional hybrid search.

export abstract class PersistentVectorStore extends VectorStore {
  /**
   * Connect to the backend and ensure the collection exists.
   * Should be idempotent (safe to call multiple times).
   */
  abstract initialize(): Promise<void>;

  /** Gracefully close connections and release resources. */
  abstract disconnect(): Promise<void>;

  /**
   * Hybrid search combining dense vectors + keyword/sparse (BM25, etc.).
   *
   * Default implementation falls back to pure vector search so that subclasses
   * only need to override this when the provider actually supports it.
   *
   * @param alpha  1.0 = pure dense, 0.0 = pure sparse (default: 0.75)
   */
  async hybridSearch(
    _query: string,
    queryEmbedding: number[],
    options?: TSearchOptions & { alpha?: number },
  ): Promise<TSearchResult[]> {
    return this.search(queryEmbedding, options);
  }
}

// For runtime / in-process stores: FAISS, in-memory, hnswlib…
// No connection lifecycle, but adds snapshot persistence.

export abstract class LocalVectorStore extends VectorStore {
  /**
   * Persist the current index/store to disk.
   * Useful for reloading state across process restarts.
   */
  abstract saveSnapshot(path: string): Promise<void>;

  /**
   * Load a previously saved snapshot from disk.
   * Should replace the current in-memory state entirely.
   */
  abstract loadSnapshot(path: string): Promise<void>;
}
