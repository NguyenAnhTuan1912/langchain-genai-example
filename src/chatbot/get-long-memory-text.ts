// Import config
import {
  TOP_K_MEMORIES,

  // Features
  LONG_TERM_MEM_FEATURE,
} from "../config";

// Import chatbot
import { Chatbot } from "./Chatbot";

Chatbot.prototype.getLongMemoryText = async function(userInput: string) {
  let memoriesText = "(Chưa có memory từ các cuộc hội thoại trước)";

  if (!LONG_TERM_MEM_FEATURE.IS_ENABLE) {
    return memoriesText;
  }

  const queryEmbedding = await this.embeddings.embedQuery(userInput);
  const relevantMemories = await this.ltm.search(queryEmbedding, TOP_K_MEMORIES);

  if (relevantMemories.length) {
    memoriesText = relevantMemories
      .map(
        ({ entry, score }, i) =>
          `[Memory ${i + 1} | relevance: ${score.toFixed(2)} | ${entry.timestamp.slice(0, 10)}]\n${entry.text}`,
      )
      .join("\n\n");
  }

  return memoriesText;
}