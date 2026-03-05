# 🧠 LangChain Bedrock Chatbot with Long-term Memory

Interactive terminal chatbot sử dụng **AWS Bedrock** làm LLM backend, tích hợp **vector-based long-term memory** để bot có thể nhớ thông tin xuyên suốt các phiên hội thoại.

## Note

Hiện tại đang có 2 tools:
- Lấy ngày giờ hiện tại.
- Lấy giá vàng.
- Tính biểu thức (gọi qua MCP Server).

## Ví dụ mẫu

1. Hỏi thử về tên của mình (Cái này là test Long Term Memory, Short Term Memory là Chat History).

![bảo ai viết phần giới thiệu về bản thân trong lần đầu](./images/image-1.png)

Sau đó thì cung cấp thêm cho nó một số thông tin mới.

![cung cấp thêm thông tin về bản thân](./images/image-2.png)

Sau đó thì tạo một session mới và hỏi lại giống câu ban đầu.

![bảo ai viết lại, và nó sẽ đưa thêm các thông tin mới](./images/image-3.png)

2. Thử hỏi về giá vàng, đây là step kết hợp giữa việc gọi 2 tools là lấy giờ hạn hiện tại và lấy giá vàng.

![tương tác với gen ai để hỏi giá vàng](./images/image.png)

3. Thử hỏi về một biểu thức, nó sẽ kết nối tới MCP Server và tính biểu thức đó.

![tính biểu thức với MCP](./images/image-4.png)

## Tổng quan

Project là một terminal chatbot với kiến trúc modular:

| Module | Vai trò |
|--------|---------|
| `main.ts` | Entry point — interactive terminal loop, xử lý commands |
| `chatbot.ts` | Khởi tạo LLM, prompt template, chain (RunnableSequence) |
| `config.ts` | Config toàn cục: region, model IDs, thresholds |
| `embedding.ts` | Gọi Cohere Embed v3 qua BedrockRuntimeClient |
| `memory.ts` | Short-term memory (BufferMemory / BufferWindowMemory) |
| `local-vector-store.ts` | Vector store cục bộ: cosine search, persist JSON |
| `functions.ts` | Các chức năng chính: chat, showMemories, searchMemories |

### Cách Long-term Memory hoạt động

```
User input
  │
  ├──→ Embed query (Cohere Multilingual v3, input_type = "search_query")
  │
  ├──→ Cosine similarity search trong vector store
  │       → Lấy top-K memories relevant nhất
  │
  ├──→ Inject vào prompt:
  │       • System prompt + long-term memories (từ vector store)
  │       • Short-term history (3 cặp Q&A gần nhất trong session)
  │       • User message hiện tại
  │
  ├──→ LLM sinh response (streaming)
  │
  └──→ Lưu cặp Q&A mới vào vector store
          (embed với input_type = "search_document", persist ra JSON file)
```

Bot có **hai tầng memory** chạy song song:

- **Short-term**: 3 cặp Q&A gần nhất trong session → giúp bot hiểu ngữ cảnh cuộc trò chuyện đang diễn ra
- **Long-term**: toàn bộ history được embed + lưu vào vector store → bot nhớ thông tin từ các session trước, recall theo semantic similarity

---

## Công nghệ sử dụng

### Core

- **TypeScript** + **Node.js** — Runtime và ngôn ngữ chính
- **LangChain.js** — Framework orchestration cho LLM (prompt template, chain, memory, streaming)

### AWS Bedrock

- **Anthropic Claude 3.5 Sonnet v2** (`anthropic.claude-3-5-sonnet-20241022-v2:0`) — LLM chính để sinh response
- **Cohere Embed Multilingual v3** (`cohere.embed-multilingual-v3`) — Embedding model, hỗ trợ tốt tiếng Việt
- **AWS SDK for JS v3** (`@aws-sdk/client-bedrock-runtime`) — Gọi trực tiếp Bedrock API cho embedding (bypass LangChain wrapper để tránh lỗi format)

### Vector Store

- **Local Vector Store** tự implement — cosine similarity search, persist ra JSON file
- Production-ready alternatives: OpenSearch Serverless, PostgreSQL + pgvector, Pinecone

### Thư viện chính

| Package | Vai trò |
|---------|---------|
| `@langchain/aws` | LangChain integration cho Bedrock (ChatBedrockConverse) |
| `@langchain/core` | Prompt templates, runnables, message types |
| `langchain` | Memory classes (BufferMemory, BufferWindowMemory) |
| `@aws-sdk/client-bedrock-runtime` | Gọi trực tiếp Bedrock cho Cohere Embed v3 |
| `ts-node` | Chạy TypeScript trực tiếp không cần build |

---

## Hướng dẫn Setup

### 1. Yêu cầu hệ thống

- **Node.js** >= 18
- **AWS Account** với Bedrock model access đã được enable
- **AWS Credentials** đã cấu hình

### 2. Enable Bedrock Models

Truy cập [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/) → **Model access** → Enable 2 model:

- `Anthropic Claude 3.5 Sonnet v2`
- `Cohere Embed Multilingual v3`

> ⚠️ Cần enable ở đúng region mà bạn sẽ sử dụng (mặc định: `us-east-1`)

### 3. Cấu hình AWS Credentials

Tạo thêm file `.env` và thêm nội dung sau vào file. Trước khi sử dụng thì nhớ tạo profile cho credentials.

```bash
AWS_REGION=ap-southeast-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
BEDROCK_EMBEDDING_MODEL_ID=cohere.embed-multilingual-v3
AWS_PROFILE=
```

### 4. Cài đặt dependencies

```bash
git clone <repo-url>
cd <repo-name>
npm install
# Hoặc
pnpm install
```

---

## Hướng dẫn sử dụng

### Chạy chatbot

Đơn giản chỉ cần dùng lệnh:

```bash
npm start
# hoặc
npx ts-node main.ts
```

### Chat

Gõ tin nhắn và Enter. Bot trả lời bằng streaming (hiển thị từng chữ):

```
👤 You: Mình tên là Tuan, đang làm về GenAI trên AWS
🤖 Bot: Chào Tuan! Rất vui được biết bạn đang làm về GenAI trên AWS...

👤 You: Mình đang build chatbot mẫu để học
🤖 Bot: Hay quá! Chatbot mẫu để học...

# --- Thoát rồi quay lại sau ---

👤 You: Bạn còn nhớ mình làm gì không?
🤖 Bot: Bạn là Tuan, đang làm về GenAI trên AWS và đang build chatbot
       cho ví dụ...
```

### Commands

| Command | Mô tả |
|---------|-------|
| `/memory` | Xem tất cả memories đã lưu (10 gần nhất) |
| `/search <query>` | Semantic search trong memory store |
| `/clear` | Xóa toàn bộ memories (cả short-term và long-term) |
| `/exit` | Thoát chương trình |

### Ví dụ debug memory

```bash
👤 You: /memory
╔══════════════════════════════════════════════╗
║         LONG-TERM MEMORY STORE               ║
║         Total: 3                             ║
╠══════════════════════════════════════════════╣
  [2025-01-15 10:30] User: Mình tên là Tuan Assistant: Chào Tuan!...
  [2025-01-15 10:31] User: Mình đang build chatbot Assistant: Hay quá!...
╚══════════════════════════════════════════════╝

👤 You: /search chatbot đại học
🔍 Search: "chatbot đại học" → 1 results

  [1] score=0.782 | 2025-01-15
      User: Mình đang build chatbot mẫu để học Assistant: Hay quá!...
```

### Cấu trúc file

```
.
├── README.md
├── chatbot.ts              # Các object cần thiết để dùng cho chatbot
├── config.ts               # Các config toàn cục
├── embedding.ts            # Lớp Embedding Agent
├── functions.ts            # Các chức năng
├── local-vector-store.ts   # Lớp Vector Store cục bộ
├── main.ts                 # Hàm chính dùng để chạy
├── memory.ts               # Khởi tạo memory (short-term memory)
├── package.json
└── tsconfig.json
```

### Lưu ý

- File `memory-store.json` được tạo tự động khi chat lần đầu. Đây là nơi lưu toàn bộ embeddings + text. Restart app vẫn giữ nguyên memory.
- Cohere Embed Multilingual v3 hỗ trợ tốt tiếng Việt, nên semantic search hoạt động với cả câu hỏi tiếng Việt.
- Với production, nên thay `LocalVectorStore` bằng OpenSearch Serverless hoặc pgvector — chỉ cần implement lại method `add()` và `search()`.
- `SIMILARITY_THRESHOLD` mặc định là `0.3` — có thể điều chỉnh nếu memory recall quá nhiều hoặc quá ít kết quả.