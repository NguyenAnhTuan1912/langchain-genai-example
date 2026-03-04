import {
  AIMessageChunk,
  ToolMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";

// Import config
import {
  TOP_K_MEMORIES,

  // Features
  LONG_TERM_MEM_FEATURE,
  RESPONSE_STREAMING_FEATURE,
  TOOL_USE_FEATURE,
} from "../config";

// Import chatbot
import { memory, chain, vectorStore, embeddings } from "../chatbot";
import { getToolsInformation } from "../tools";

async function getLongMemoryText(userInput: string) {
  let memoriesText = "(Chưa có memory từ các cuộc hội thoại trước)";

  if (!LONG_TERM_MEM_FEATURE.IS_ENABLE) {
    return memoriesText;
  }

  const queryEmbedding = await embeddings.embedQuery(userInput);
  const relevantMemories = vectorStore.search(queryEmbedding, TOP_K_MEMORIES);

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

async function handleToolUse(
  aiResponse: AIMessageChunk,
  userInput: string,
  chatHistory: any[],
  memoriesText: string,
  onStreaming?: (msg: string) => void,
) {
  if (!TOOL_USE_FEATURE.IS_ENABLE) {
    return;
  }

  const [_, toolByName] = getToolsInformation();
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

      const selectedTool = toolByName.get(toolCall.name);

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
      input: userInput,
      chat_history: [...chatHistory, new HumanMessage(userInput), ...messages],
      long_term_memories: memoriesText,
    };
    const { response } = await handleInference(chainInput, onStreaming);

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
}

async function handleInference(
  chainInput: Record<string, any>,
  onStreaming?: (msg: string) => void,
) {
  let fullAImessage = "";
  let fullResponse: AIMessageChunk | undefined;

  if (RESPONSE_STREAMING_FEATURE.IS_ENABLE) {
    // Invoke chain với input + history
    const response = await chain.stream(chainInput);

    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = args[0]?.toString() || "";
      if (msg.includes("already exists in this message chunk")) return;
      originalWarn.apply(console, args);
    };

    for await (const aiMessage of response) {
      fullResponse = fullResponse ? concat(fullResponse, aiMessage) : aiMessage;

      let chunk =
        typeof aiMessage.content === "string"
          ? aiMessage.content
          : "";

      fullAImessage += chunk;

      if (chunk && onStreaming) onStreaming(chunk);
    }
  } else {
    const response = await chain.invoke(chainInput);

    fullResponse = response;
    fullAImessage =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
  }

  return { message: fullAImessage, response: fullResponse };
}

/**
 * Chat feature.
 * @param userInput
 * @param onStreaming
 * @returns
 */
export async function chat(
  userInput: string,
  onStreaming?: (msg: string) => void,
): Promise<string> {
  const memoriesText = await getLongMemoryText(userInput);
  const memoryVars = await memory.loadMemoryVariables({});
  const chatHistory = memoryVars.chat_history || [];
  const chainInput = {
    input: userInput,
    chat_history: chatHistory,
    long_term_memories: memoriesText,
  };

  const { message, response } = await handleInference(chainInput, onStreaming);

  if (!response) return "";

  let finalMessage = message;

  if (response.tool_calls?.length) {
    const messages: any[] = [...chatHistory, new HumanMessage(userInput)];

    const result = await handleToolUse(
      response,
      userInput,
      messages,
      memoriesText,
      onStreaming,
    );
    finalMessage = result?.response ?? "";
  }

  // Lưu cặp input/output vào st và lt memory
  await memory.saveContext({ input: userInput }, { output: message });

  if (LONG_TERM_MEM_FEATURE.IS_ENABLE) {
    const memoryText = `User: ${userInput}\nAssistant: ${message}`;
    const memoryEmbedding = await embeddings.embedDocuments([memoryText]);

    await vectorStore.add(memoryText, memoryEmbedding[0], {
      userInput,
      aiResponse: message,
    });
  }

  return message;
}
