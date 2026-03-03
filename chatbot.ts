import { config } from "dotenv";
import { ChatBedrockConverse, BedrockEmbeddings } from "@langchain/aws";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

config();

// Import config
import {
  MODEL_ID,
  AWS_REGION,
  EMBEDDING_MODEL_ID,
  MEMORY_FILE_PATH,
} from "./config";

import { createChatHistoryMemory } from "./memory";
import { LocalVectorStore } from "./local-vector-store";
import { EmbeddingAgent } from "./embedding";

export const llm = new ChatBedrockConverse({
  model: MODEL_ID,
  region: AWS_REGION,
  temperature: 0.7,
  maxTokens: 1024,
  streaming: true,
});
export const memory = createChatHistoryMemory("window");

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Bạn là một trợ lý AI thông minh, thân thiện, trả lời bằng tiếng Việt.

## Long-term Memory
Dưới đây là những thông tin bạn nhớ từ các cuộc hội thoại trước với user.
Hãy sử dụng chúng một cách tự nhiên khi relevant, không cần nhắc rằng bạn đang dùng memory.
Nếu memory không liên quan đến câu hỏi hiện tại, bỏ qua nó.

{long_term_memories}

## Instructions
- Trả lời ngắn gọn, chính xác
- Tham chiếu thông tin từ memory khi phù hợp
- Nếu user hỏi "bạn còn nhớ không?", hãy search trong memory context ở trên`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

export const chain = RunnableSequence.from([
  {
    input: (i: any) => i.input,
    chat_history: (i: any) => i.chat_history,
    long_term_memories: (i: any) => i.long_term_memories,
  },
  prompt,
  llm,
]);

export const embeddings = new EmbeddingAgent();

export const vectorStore = new LocalVectorStore(MEMORY_FILE_PATH);
