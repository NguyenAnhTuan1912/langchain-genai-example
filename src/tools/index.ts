// Import tools
import { getCurrentDateTimeTool } from "./example-tool";

/**
 * Get all tools information in application.
 * @returns 
 */
export function getToolsInformation() {
  const tools = [
    getCurrentDateTimeTool
  ];
  const toolByName = new Map([
    [getCurrentDateTimeTool.name, getCurrentDateTimeTool],
  ]);

  return [tools, toolByName] as const;
}
