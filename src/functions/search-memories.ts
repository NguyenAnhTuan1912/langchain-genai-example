// Import config
import { TOP_K_MEMORIES } from "../config";

// Import chatbot
import { memory, chain, vectorStore, embeddings } from "../chatbot";

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
