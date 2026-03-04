import axios, { AxiosRequestConfig } from "axios";

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getGoldPriceTool = tool(
  async (input: any) => {
    const url = "https://www.vang.today/api/prices";
    const { date } = input || {};

    try {
      const options: AxiosRequestConfig = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (date != "current") {
        const d = new Date(date);
        options.params = {
          days: new Date().getDay() - d.getDay()
        };
      }

      const response = await axios.get(url, options);
      let data = response.data;

      if (data.history) {
        let target = data.history.at(-1);

        data = {
          date: target.date,
          prices: target.prices
        }
      } else {
        data = {
          date: data.date,
          prices: data.prices
        }
      }

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
      "Khi người dùng cần biết giá vàng tại một thời điểm nào đó (có thể là hiện tại), thì dùng tool này.",
    schema: z.object({
      date: z
        .string()
        .describe(
          "Ngày, tháng, năm của thời điểm mà người dùng muốn bao gồm 2 format là current hoặc dd/mm/yyyy",
        ),
    }),
  },
);
