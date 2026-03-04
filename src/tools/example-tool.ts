import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentDateTimeTool = tool(
  async () => {
    const now = new Date();
    return JSON.stringify({
      date: now.toLocaleDateString("vi-VN"),
      time: now.toLocaleTimeString("vi-VN"),
      iso: now.toISOString(),
      timestamp: now.getTime(),
    });
  },
  {
    name: "get_current_datetime",
    description: "Lấy ngày giờ hiện tại. Dùng khi user hỏi về thời gian, ngày tháng.",
    schema: z.object({}),
  }
);