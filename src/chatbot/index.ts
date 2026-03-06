import { Chatbot } from "./Chatbot";

// Export functions
export * from "./chat";
export * from "./get-long-memory-text";
export * from "./handle-inference";
export * from "./handle-tool-use";
export * from "./search-memories";
export * from "./show-memory";

import { setupLLM } from "./llm";

export async function createChatbot() {
  const chatBotConstructorInput = await setupLLM();
  const chatbot = new Chatbot(chatBotConstructorInput);
  return chatbot;
}
