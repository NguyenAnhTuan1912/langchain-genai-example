import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Import config
import { AWS_REGION, EMBEDDING_MODEL_ID } from "./config";

export class EmbeddingAgent {
  bedrockRuntime: BedrockRuntimeClient;

  constructor() {
    this.bedrockRuntime = new BedrockRuntimeClient({ region: AWS_REGION });
  }

  async embedTexts(
    texts: string[],
    inputType: "search_document" | "search_query" = "search_document",
  ): Promise<number[][]> {
    const response = await this.bedrockRuntime.send(
      new InvokeModelCommand({
        modelId: EMBEDDING_MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          texts,
          input_type: inputType,
        }),
      }),
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const results = await this.embedTexts([text], "search_query");
    return results[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const BATCH_SIZE = 96;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await this.embedTexts(batch, "search_document");
      allEmbeddings.push(...batchResults);
    }

    return allEmbeddings;
  }
}
