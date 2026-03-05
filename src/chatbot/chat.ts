import { HumanMessage } from "@langchain/core/messages";

// Import config
import {
  // Features
  LONG_TERM_MEM_FEATURE,
} from "../config";

// Import chatbot
import { Chatbot } from "./Chatbot";

/**
 * Chat feature.
 * @param userInput
 * @param onStreaming
 * @returns
 */
Chatbot.prototype.chat = async function (
  userInput: string,
  onStreaming?: (msg: string) => void,
): Promise<string> {
  const memoriesText = await this.getLongMemoryText(userInput);
  const memoryVars = await this.stm.loadMemoryVariables({});
  const chatHistory = memoryVars.chat_history || [];
  const chainInput = {
    input: userInput,
    chat_history: chatHistory,
    long_term_memories: memoriesText,
  };

  const { message, response } = await this.handleInference(
    chainInput,
    onStreaming,
  );

  if (!response) return "";

  let finalMessage = message;

  if (response.tool_calls?.length) {
    const messages: any[] = [...chatHistory, new HumanMessage(userInput)];

    const result = await this.handleToolUse(
      response,
      userInput,
      messages,
      memoriesText,
      onStreaming,
    );
    finalMessage = result?.response ?? "";
  }

  // Lưu cặp input/output vào st và lt memory
  await this.stm.saveContext({ input: userInput }, { output: message });

  if (LONG_TERM_MEM_FEATURE.IS_ENABLE) {
    const memoryText = `User: ${userInput}\nAssistant: ${message}`;
    const memoryEmbedding = await this.embeddings.embedDocuments([memoryText]);

    await this.ltm.add(memoryText, memoryEmbedding[0], {
      userInput,
      aiResponse: message,
    });
  }

  return message;
};
