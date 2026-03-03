import { BufferMemory, BufferWindowMemory } from "langchain/memory";

/**
 * Create a short-term memory with chat history (store in RAM).
 * @param type
 * @returns 
 */
export function createChatHistoryMemory(type: string) {
  switch (type) {
    case "normal": {
      return new BufferMemory({
        returnMessages: true, // Trả về dạng Message objects
        memoryKey: "chat_history", // Key để inject vào prompt
        inputKey: "input",
        outputKey: "output",
      });
    }

    case "window":
    default: {
      return new BufferWindowMemory({
        k: 10, // Giữ 10 cặp message gần nhất
        returnMessages: true,
        memoryKey: "chat_history",
        inputKey: "input",
        outputKey: "output",
      });
    }
  }
}
