import * as readline from "readline";

// Import chatbot
import { createChatbot } from "./src/chatbot";

// Import configs
import { AWS_REGION, MODEL_ID, EMBEDDING_MODEL_ID } from "./src/config";

async function main() {
  const chatbot = await createChatbot();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("┌─────────────────────────────────────────────────┐");
  console.log("│  🧠 Bedrock Chatbot with Long-term Memory       │");
  console.log("│                                                 │");
  console.log("│  LLM       : " + MODEL_ID.substring(0, 35).padEnd(35) + "│");
  console.log(
    "│  Embedding : " + EMBEDDING_MODEL_ID.substring(0, 35).padEnd(35) + "│",
  );
  console.log("│  Region    : " + AWS_REGION.padEnd(35) + "│");
  console.log("│  Memories  : Support both Long Term and Short Term │");
  console.log("│                                                 │");
  console.log("│  Commands:                                      │");
  console.log("│    /memory          — xem tất cả memories       │");
  console.log("│    /search <query>  — search memories            │");
  console.log("│    /clear           — xóa toàn bộ memory        │");
  console.log("│    /exit            — thoát                     │");
  console.log("└─────────────────────────────────────────────────┘");
  console.log();

  const askQuestion = () => {
    rl.question("👤 You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      // Handle commands
      if (trimmed === "/exit" || trimmed === "/quit") {
        console.log("\n👋 Tạm biệt!\n");
        rl.close();
        process.exit(0);
      }

      if (trimmed === "/memory") {
        await chatbot.showMemory();
        askQuestion();
        return;
      }

      if (trimmed.startsWith("/search ")) {
        const query = trimmed.slice(8).trim();
        if (query) await chatbot.searchMemories(query);
        askQuestion();
        return;
      }

      if (trimmed === "/clear") {
        await chatbot.stm.clear();
        console.log("🗑️  Memory đã được xóa.\n");
        askQuestion();
        return;
      }

      // Chat
      try {
        process.stdout.write("🤖 Bot: ");

        await chatbot.chat(trimmed, (chunk) => {
          process.stdout.write(chunk);
        });

        console.log("\n");
      } catch (error: any) {
        console.error(`\n❌ Error: ${error.message}`);

        if (error.message?.includes("AccessDeniedException")) {
          console.error(
            "   → Kiểm tra lại Bedrock model access trong AWS Console",
          );
        }
        if (error.message?.includes("credentials")) {
          console.error(
            "   → Kiểm tra AWS credentials (aws configure hoặc env vars)",
          );
        }
        console.log();
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
