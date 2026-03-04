import { config } from "dotenv";
import { ChatBedrockConverse } from "@langchain/aws";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

config();

// Import config
import {
  MODEL_ID,
  AWS_REGION,

  // Features
  TOOL_USE_FEATURE
} from "../config";

// Import tools
import { getToolsInformation } from "../tools";

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

let finalLLM: any = llm;

// Setup features
if (TOOL_USE_FEATURE.IS_ENABLE) {
  const [tools, _] = getToolsInformation();
  console.log("BIND TOOLS:", tools.length, "tools");
  finalLLM = llm.bindTools(tools);
}

export const defaultLLM = {
  llm: finalLLM,
  prompt
};
