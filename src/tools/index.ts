// Import tools
import { getCurrentDateTimeTool } from "./example-tool";
import { getGoldPriceTool } from "./example-api-call-tool";

/**
 * Get all tools information in application.
 * @returns
 */
export function getToolsInformation() {
  const tools = [getCurrentDateTimeTool, getGoldPriceTool];
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

  return [tools, toolByName] as const;
}
