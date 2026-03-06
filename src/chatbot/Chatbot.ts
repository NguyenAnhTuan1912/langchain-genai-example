import { ChatBedrockConverse } from "@langchain/aws";
import { RunnableSequence } from "@langchain/core/runnables";
import { BufferMemory, BufferWindowMemory } from "langchain/memory";
import { AIMessageChunk } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ZodObject } from "zod";

import { LongTermMemory } from "../memory"
import { BedrockEmbeddingAgent } from "../embedding";

export interface Chatbot {
  llm: ChatBedrockConverse;
  chain: RunnableSequence;
  embeddings: BedrockEmbeddingAgent;
  stm: BufferMemory | BufferWindowMemory;
  ltm: LongTermMemory;
  allToolsByName: Map<
    string,
    DynamicStructuredTool<ZodObject<{}, any>, unknown, unknown, string>
  >;

  chat(userInput: string, onStreaming?: (msg: string) => void): Promise<string>;
  searchMemories(query: string): Promise<void>;
  showMemory(): Promise<void>;
  getLongMemoryText(userInput: string): Promise<string>;
  handleToolUse(
    aiResponse: AIMessageChunk,
    userInput: string,
    chatHistory: any[],
    memoriesText: string,
    onStreaming?: (msg: string) => void,
  ): Promise<
    | {
        response: string;
        toolCalls: any[];
      }
    | undefined
  >;
  handleInference(
    chainInput: Record<string, any>,
    onStreaming?: (msg: string) => void,
  ): Promise<{
    message: string;
    response: AIMessageChunk | undefined;
  }>;
}

export class Chatbot {
  constructor(input: {
    llm: ChatBedrockConverse;
    chain: RunnableSequence;
    stm: BufferMemory | BufferWindowMemory;
    ltm: LongTermMemory;
    embeddings: BedrockEmbeddingAgent;
    allTools?: DynamicStructuredTool<
      ZodObject<{}, any>,
      unknown,
      unknown,
      string
    >[];
  }) {
    this.llm = input.llm;
    this.chain = input.chain;
    this.stm = input.stm;
    this.embeddings = input.embeddings;
    this.ltm = input.ltm;

    if (input.allTools) {
      this.setAllTools(input.allTools);
    }
  }

  setAllTools(
    allTools: DynamicStructuredTool<
      ZodObject<{}, any>,
      unknown,
      unknown,
      string
    >[],
  ) {
    this.allToolsByName = new Map(allTools.map((tool) => [tool.name, tool]));
  }
}
