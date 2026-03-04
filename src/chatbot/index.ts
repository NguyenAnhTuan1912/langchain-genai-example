import { config } from "dotenv";
import { RunnableSequence } from "@langchain/core/runnables";

config();

// Import config
import {
  MEMORY_FILE_PATH,
} from "../config";

import { createChatHistoryMemory } from "../stm";
import { LocalVectorStore } from "../vector-store";
import { EmbeddingAgent } from "../embedding";

import { defaultLLM } from "./llm";

export const memory = createChatHistoryMemory("window");

export const chain = RunnableSequence.from([
  {
    input: (i: any) => i.input,
    chat_history: (i: any) => i.chat_history,
    long_term_memories: (i: any) => i.long_term_memories,
  },
  defaultLLM.prompt,
  defaultLLM.llm,
]);

export const embeddings = new EmbeddingAgent();

export const vectorStore = new LocalVectorStore(MEMORY_FILE_PATH);
