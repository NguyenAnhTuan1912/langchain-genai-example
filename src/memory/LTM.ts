export type TMemoryEntry = {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  metadata?: Record<string, any> & {
    userInput: string;
    aiResponse: string;
    topic?: string;
  };
};

/**
 * This class is currently in experiment
 */
export abstract class LongTermMemory {
  abstract add(
    text: string,
    embedding: number[],
    metadata?: TMemoryEntry["metadata"],
  ): Promise<boolean>;

  abstract search(
    queryEmbedding: number[],
    topK?: number,
    threshold?: number,
  ): Promise<{ entry: TMemoryEntry; score: number }[]>;

  abstract getAll(): TMemoryEntry[];
}
