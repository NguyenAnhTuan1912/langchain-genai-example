export type TMemoryEntry = {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  metadata?: {
    userInput: string;
    aiResponse: string;
    topic?: string;
  };
};

export abstract class VectorStore {
  abstract add(
    text: string,
    embedding: number[],
    metadata?: TMemoryEntry["metadata"],
  ): Promise<void>;

  abstract search(
    queryEmbedding: number[],
    topK?: number,
    threshold?: number,
  ): { entry: TMemoryEntry; score: number }[];
}
