export abstract class EmbeddingAgent {
  abstract embedTexts(
    texts: string[],
    inputType?: "search_document" | "search_query",
  ): Promise<number[][]>;

  abstract embedQuery(text: string): Promise<number[]>;

  abstract embedDocuments(texts: string[]): Promise<number[][]>;
}
