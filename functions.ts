// Import config
import { TOP_K_MEMORIES } from "./config";

// Import chatbot
import { memory, chain, vectorStore, embeddings } from "./chatbot";

export async function chat(
  userInput: string,
  onStreaming?: (msg: string) => void,
): Promise<string> {
  const queryEmbedding = await embeddings.embedQuery(userInput);
  const relevantMemories = vectorStore.search(queryEmbedding, TOP_K_MEMORIES);

  const memoriesText =
    relevantMemories.length > 0
      ? relevantMemories
          .map(
            ({ entry, score }, i) =>
              `[Memory ${i + 1} | relevance: ${score.toFixed(2)} | ${entry.timestamp.slice(0, 10)}]\n${entry.text}`,
          )
          .join("\n\n")
      : "(Chưa có memory từ các cuộc hội thoại trước)";

  // Load memory variables (lấy chat_history hiện tại)
  const memoryVars = await memory.loadMemoryVariables({});

  // Invoke chain với input + history
  const response = await chain.stream({
    input: userInput,
    chat_history: memoryVars.chat_history || [],
    long_term_memories: memoriesText,
  });

  let fullAImessage = "";

  for await (const aiMessage of response) {
    let chunk =
      typeof aiMessage.content === "string"
        ? aiMessage.content
        : JSON.stringify(aiMessage.content);

    fullAImessage += chunk;

    if (onStreaming) onStreaming(chunk);
  }

  // Lưu cặp input/output vào st và lt memory
  await memory.saveContext({ input: userInput }, { output: fullAImessage });
  const memoryText = `User: ${userInput}\nAssistant: ${fullAImessage}`;
  const memoryEmbedding = await embeddings.embedDocuments([memoryText]);

  await vectorStore.add(memoryText, memoryEmbedding[0], {
    userInput,
    aiResponse: fullAImessage,
  });

  return fullAImessage;
}

export async function showMemory(): Promise<void> {
  const memories = vectorStore.getAll();

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         LONG-TERM MEMORY STORE               ║");
  console.log(`║         Total: ${String(memories.length).padEnd(30)}║`);
  console.log("╠══════════════════════════════════════════════╣");

  if (memories.length === 0) {
    console.log("║  (trống — chưa có memory nào)                ║");
  } else {
    const recent = memories.slice(-10); // Show 10 gần nhất
    recent.forEach((mem, i) => {
      const preview = mem.text.replace(/\n/g, " ").substring(0, 65);
      const date = mem.timestamp.slice(0, 16).replace("T", " ");
      console.log(`  [${date}] ${preview}...`);
    });
    if (memories.length > 10) {
      console.log(`  ... và ${memories.length - 10} memories khác`);
    }
  }

  console.log("╚══════════════════════════════════════════════╝\n");
}

export async function searchMemories(query: string): Promise<void> {
  const queryEmbedding = await embeddings.embedQuery(query);
  const results = vectorStore.search(queryEmbedding, 5, 0.3);

  console.log(`\n🔍 Search: "${query}" → ${results.length} results\n`);

  results.forEach(({ entry, score }, i) => {
    const preview = entry.text.replace(/\n/g, " ").substring(0, 80);
    console.log(
      `  [${i + 1}] score=${score.toFixed(3)} | ${entry.timestamp.slice(0, 10)}`,
    );
    console.log(`      ${preview}...\n`);
  });
}
