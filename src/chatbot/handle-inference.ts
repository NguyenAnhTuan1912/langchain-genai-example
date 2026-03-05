import { AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";

// Import config
import {
  // Features
  RESPONSE_STREAMING_FEATURE,
} from "../config";

// Import chatbot
import { Chatbot } from "./Chatbot";

Chatbot.prototype.handleInference = async function (
  chainInput: Record<string, any>,
  onStreaming?: (msg: string) => void,
) {
  let fullAImessage = "";
  let fullResponse: AIMessageChunk | undefined;

  if (RESPONSE_STREAMING_FEATURE.IS_ENABLE) {
    // Invoke chain với input + history
    const response = await this.chain.stream(chainInput);

    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = args[0]?.toString() || "";
      if (msg.includes("already exists in this message chunk")) return;
      originalWarn.apply(console, args);
    };

    for await (const aiMessage of response) {
      fullResponse = fullResponse ? concat(fullResponse, aiMessage) : aiMessage;

      let chunk =
        typeof aiMessage.content === "string" ? aiMessage.content : "";

      fullAImessage += chunk;

      if (chunk && onStreaming) onStreaming(chunk);
    }
  } else {
    const response = await this.chain.invoke(chainInput);

    fullResponse = response;
    fullAImessage =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
  }

  return { message: fullAImessage, response: fullResponse };
};
