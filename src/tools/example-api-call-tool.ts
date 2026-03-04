import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const fetchApiTool = tool(
  async (input: any) => {
    const { method, url, body } = input || {};
    
    try {
      const options: RequestInit = {
        method: method || "GET",
        headers: {
          "Content-Type": "application/json",
          // Thêm auth header nếu cần:
          // "Authorization": `Bearer ${process.env.API_TOKEN}`,
        },
      };

      if (body && method !== "GET") {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json();

      // Truncate nếu response quá dài (tránh exceed context window)
      const text = JSON.stringify(data, null, 2);
      if (text.length > 3000) {
        return text.substring(0, 3000) + "\n... (truncated)";
      }
      return text;
    } catch (error: any) {
      return `Lỗi khi gọi API: ${error.message}`;
    }
  },
  {
    name: "fetch_api",
    description:
      "Gọi một REST API endpoint. Dùng khi cần lấy hoặc gửi dữ liệu " +
      "tới một API cụ thể mà user yêu cầu.",
    schema: z.object({
      url: z.string().describe("URL đầy đủ của API endpoint"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE"])
        .default("GET")
        .describe("HTTP method"),
      body: z
        .any()
        .optional()
        .describe("Request body (dạng JSON object) cho POST/PUT"),
    }),
  }
);