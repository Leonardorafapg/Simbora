/** URL pública do MCP do Simbora (a que o Claude pede ao adicionar o conector). */
export const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL ?? "https://mcp-oauth-production-3342.up.railway.app/mcp";

export const CLAUDE_CONNECTORS_URL = "https://claude.ai/settings/connectors";

export const CLAUDE_CODE_COMMAND = `claude mcp add --transport http simbora ${MCP_URL}`;
