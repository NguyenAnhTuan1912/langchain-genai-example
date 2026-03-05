import { config } from "dotenv";
import { ChatBedrockConverse } from "@langchain/aws";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { MCPClient } from "../mcp-client";

config();

// Import config
import {
  MODEL_ID,
  AWS_REGION,
  MEMORY_FILE_PATH,

  // Features
  MCP_SERVERS,
  TOOL_USE_FEATURE,
} from "../config";

// Import tools
import { getToolsInformation } from "../tools";

import { createChatHistoryMemory } from "../stm";
import { LocalVectorStore } from "../vector-store";
import { BedrockEmbeddingAgent } from "../embedding";

// Config test client
const mcpClient = new MCPClient();

const llm = new ChatBedrockConverse({
  model: MODEL_ID,
  region: AWS_REGION,
  temperature: 0.7,
  maxTokens: 1024,
  streaming: true,
});

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

export async function setupLLM() {
  let finalLLM: any = llm;
  let allTools: any[] = [];

  if (TOOL_USE_FEATURE.IS_ENABLE) {
    const [localTools, _] = getToolsInformation();
    console.log(`  🔧 Found ${localTools.length} local tools`);

    // Connect MCP servers
    await mcpClient.connectAll(MCP_SERVERS);
    const mcpTools = await mcpClient.getTools();
    console.log(`  🔧 Found ${mcpTools.length} MCP tools`);

    // Gộp tất cả rồi bind 1 lần
    allTools = [...localTools, ...mcpTools];
    finalLLM = llm.bindTools(allTools);
    console.log(`  🔧 Bound ${allTools.length} total tools to LLM`);
  }

  const chain = RunnableSequence.from([
    {
      input: (i: any) => i.input,
      chat_history: (i: any) => i.chat_history,
      long_term_memories: (i: any) => i.long_term_memories,
    },
    prompt,
    finalLLM,
  ]);

  const embeddings = new BedrockEmbeddingAgent();

  const stm = createChatHistoryMemory("window");

  const ltm = new LocalVectorStore(MEMORY_FILE_PATH);

  return { llm: finalLLM, prompt, stm, chain, embeddings, ltm, allTools };
}
