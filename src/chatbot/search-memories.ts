import { Chatbot } from "./Chatbot";

Chatbot.prototype.searchMemories = async function(query: string): Promise<void> {
  const queryEmbedding = await this.embeddings.embedQuery(query);
  const results = await this.ltm.search(queryEmbedding, 5, 0.3);

  console.log(`\n🔍 Search: "${query}" → ${results.length} results\n`);

  results.forEach(({ entry, score }, i) => {
    const preview = entry.text.replace(/\n/g, " ").substring(0, 80);
    console.log(
      `  [${i + 1}] score=${score.toFixed(3)} | ${entry.timestamp.slice(0, 10)}`,
    );
    console.log(`      ${preview}...\n`);
  });
}
