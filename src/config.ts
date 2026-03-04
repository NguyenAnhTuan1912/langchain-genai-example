import { config } from "dotenv";

config();

export const AWS_REGION = process.env.AWS_REGION || "us-east-1";
export const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";
export const EMBEDDING_MODEL_ID =
  process.env.BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";
export const MEMORY_FILE_PATH = "./memory-store.json";
export const TOP_K_MEMORIES = 5;
export const SIMILARITY_THRESHOLD = 0.3;

// Features
export const LONG_TERM_MEM_FEATURE = {
  IS_ENABLE: true
};

export const RESPONSE_STREAMING_FEATURE = {
  IS_ENABLE: true
};

export const TOOL_USE_FEATURE = {
  IS_ENABLE: true,
  MAX_TOOL_ITERATIONS: 5
};
