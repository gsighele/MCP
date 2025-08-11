import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerJinaTools } from "./tools/jina-tools.js";
import { stringify as yamlStringify } from "yaml";

// Build-time constants (can be replaced by build tools)
const SERVER_VERSION = "1.0.0"; // This could be replaced by CI/CD
const SERVER_NAME = "jina-mcp";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Jina AI Official MCP Server",
		description: "Official MCP for Jina AI API.",
		version: SERVER_VERSION,
	});


	async init() {
		// Register all Jina AI tools
		registerJinaTools(this.server, () => this.props);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Extract bearer token from Authorization header
		const authHeader = request.headers.get("Authorization");
		if (authHeader?.startsWith("Bearer ")) {
			ctx.props = { bearerToken: authHeader.substring(7) };
		}

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Handle root path with helpful information
		if (url.pathname === "/") {
			const info = {
				name: "Jina AI Official MCP Server",
				description: "Official Model Context Protocol server for Jina AI APIs",
				version: SERVER_VERSION,
				package_name: SERVER_NAME,
				usage: `
{
	"mcpServers": {
	"jina-mcp-server": {
		"url": "https://mcp.jina.ai/sse",
		"headers": {
		"Authorization": "Bearer \${JINA_API_KEY}" // optional
		}
	}
	}
}				
`,
				endpoints: {
					sse: "/sse - Server-Sent Events endpoint (recommended)",
					mcp: "/mcp - Standard JSON-RPC endpoint"
				},
				tools: [
					"read_url - Extract clean content from web pages",
					"capture_screenshot_url - Capture webpage screenshots",
					"search_web - Search the web for current information",
					"search_arxiv - Search academic papers on arXiv",
					"search_image - Search for images across the web",
					"sort_by_relevance - Rerank documents by relevance to a query",
					"deduplicate_strings - Get top-k semantically unique strings",
					"deduplicate_images - Get top-k semantically unique images as PNG base64"
				],
				source_code: "https://github.com/jina-ai/MCP",
				get_api_key: "https://jina.ai/api-dashboard/"
			};

			return new Response(yamlStringify(info), {
				headers: { "Content-Type": "text/yaml" },
				status: 200
			});
		}

		// Return helpful 404 for unknown paths
		return new Response(yamlStringify({
			error: "Endpoint not found",
			message: `Path '${url.pathname}' is not available`,
			available_endpoints: ["/", "/sse", "/mcp"],
			suggestion: "Use /sse for MCP client connections"
		}), {
			headers: { "Content-Type": "text/yaml" },
			status: 404
		});
	},
};
