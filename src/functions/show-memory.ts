// Import config
import { TOP_K_MEMORIES } from "../config";

// Import chatbot
import { memory, chain, vectorStore, embeddings } from "../chatbot";

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
