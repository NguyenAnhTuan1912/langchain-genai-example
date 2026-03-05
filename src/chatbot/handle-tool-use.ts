import {
  AIMessageChunk,
  ToolMessage,
  HumanMessage,
} from "@langchain/core/messages";

// Import config
import { TOOL_USE_FEATURE } from "../config";

// Import chatbot
import { Chatbot } from "./Chatbot";

Chatbot.prototype.handleToolUse = async function (
  aiResponse: AIMessageChunk,
  userInput: string,
  chatHistory: any[],
  memoriesText: string,
  onStreaming?: (msg: string) => void,
) {
  if (!TOOL_USE_FEATURE.IS_ENABLE) {
    return;
  }

  const allToolCalls: any[] = [];
  const messages = chatHistory ? [...chatHistory] : [];

  let currentResponse = aiResponse;
  let iterations = 0;

  while (iterations < TOOL_USE_FEATURE.MAX_TOOL_ITERATIONS) {
    iterations++;

    // Không có tool calls → final response
    if (!currentResponse?.tool_calls?.length) {
      const text =
        typeof currentResponse.content === "string"
          ? currentResponse.content
          : "";
      return { response: text, toolCalls: allToolCalls };
    }

    // Có tool calls → push AI message + gọi từng tool
    messages.push(currentResponse);

    for (const toolCall of currentResponse.tool_calls) {
      allToolCalls.push(toolCall);

      const selectedTool = this.allToolsByName.get(toolCall.name);

      if (!selectedTool) {
        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `Tool "${toolCall.name}" không tồn tại.`,
          }),
        );
        continue;
      }

      try {
        const toolResult = await selectedTool.invoke(toolCall.args);

        // console.log("Tool result:", toolResult);

        const resultText =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult);

        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: resultText,
          }),
        );
      } catch (error: any) {
        // console.log("Tool error:", error);

        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `Lỗi khi gọi tool: ${error.message}`,
          }),
        );
      }
    }

    // Gọi LLM lại qua handleInference (stream hoặc invoke)
    const chainInput = {
      input: "Hãy trả lời user dựa trên kết quả tool vừa gọi.",
      chat_history: [...chatHistory, new HumanMessage(userInput), ...messages],
      long_term_memories: memoriesText,
    };
    const { response } = await this.handleInference(chainInput, onStreaming);

    if (!response) {
      return { response: "", toolCalls: allToolCalls };
    }

    // Set cho lượt loop tiếp
    currentResponse = response;
  }

  // Nếu vượt max iterations
  return {
    response: "Đã đạt giới hạn số lần gọi tool. Vui lòng thử lại.",
    toolCalls: allToolCalls,
  };
};
