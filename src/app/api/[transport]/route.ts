import { createMcpHandler } from "mcp-handler";
import { registerMcpTools } from "@/lib/mcp/tools";

const handler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {},
  {
    basePath: "/api",
    maxDuration: 30,
    verboseLogs: false,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
