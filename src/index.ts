import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// URL normalization function based on Jina DeepResearch
function normalizeUrl(urlString: string, options = {
	removeAnchors: true,
	removeSessionIDs: true,
	removeUTMParams: true,
	removeTrackingParams: true,
	removeXAnalytics: true
}) {
	try {
		urlString = urlString.replace(/\s+/g, '').trim();

		if (!urlString?.trim()) {
			throw new Error('Empty URL');
		}

		// Handle x.com and twitter.com URLs with /analytics
		if (options.removeXAnalytics) {
			const xComPattern = /^(https?:\/\/(www\.)?(x\.com|twitter\.com)\/([^/]+)\/status\/(\d+))\/analytics(\/)?(\?.*)?(#.*)?$/i;
			const xMatch = urlString.match(xComPattern);
			if (xMatch) {
				let cleanUrl = xMatch[1];
				if (xMatch[7]) cleanUrl += xMatch[7];
				if (xMatch[8]) cleanUrl += xMatch[8];
				urlString = cleanUrl;
			}
		}

		const url = new URL(urlString);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error('Unsupported protocol');
		}

		url.hostname = url.hostname.toLowerCase();
		if (url.hostname.startsWith('www.')) {
			url.hostname = url.hostname.slice(4);
		}

		if ((url.protocol === 'http:' && url.port === '80') ||
			(url.protocol === 'https:' && url.port === '443')) {
			url.port = '';
		}

		// Query parameter filtering
		const searchParams = new URLSearchParams(url.search);
		const filteredParams = Array.from(searchParams.entries())
			.filter(([key]) => {
				if (key === '') return false;
				if (options.removeSessionIDs && /^(s|session|sid|sessionid|phpsessid|jsessionid|aspsessionid|asp\.net_sessionid)$/i.test(key)) {
					return false;
				}
				if (options.removeUTMParams && /^utm_/i.test(key)) {
					return false;
				}
				if (options.removeTrackingParams && /^(ref|referrer|fbclid|gclid|cid|mcid|source|medium|campaign|term|content|sc_rid|mc_[a-z]+)$/i.test(key)) {
					return false;
				}
				return true;
			})
			.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

		url.search = new URLSearchParams(filteredParams).toString();

		if (options.removeAnchors) {
			url.hash = '';
		}

		return url.toString();
	} catch (error) {
		return undefined;
	}
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Jina AI Offical MCP Server",
		description: "This is the official MCP server to interact with the Jina AI API.",
		version: "1.0.0",
	});
	

	async init() {
	
		this.server.tool(
			"show_api_key",
			"Display the bearer token from the Authorization header of the current request",
			{},
			async () => {
				const token = this.props.bearerToken as string;
				if (!token) {
					return {
						content: [
							{
								type: "text",
								text: "No bearer token found in request",
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text",
							text: token,
						},
					],
				};
			},
		);

		this.server.tool(
			"read_url",
			"Convert any web page URL to clean markdown content using Jina Reader API. Returns both the main content and optional structured data including links and images.",
			{ 
				url: z.string().url().describe("The HTTP/HTTPS URL to convert to markdown"),
				withAllLinks: z.boolean().optional().describe("Include all page links in structured data response"),
				withAllImages: z.boolean().optional().describe("Include all page images in structured data response")
			},
			async ({ url, withAllLinks, withAllImages }, _extra) => {
				try {
					// Normalize the URL first
					const normalizedUrl = normalizeUrl(url);
					if (!normalizedUrl) {
						return {
							content: [
								{
									type: "text",
									text: "Error: Invalid or unsupported URL",
								},
							],
						};
					}

					const headers: Record<string, string> = {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'X-Md-Link-Style': 'discarded',
					};

					// Add Authorization header if bearer token is available
					if (this.props.bearerToken) {
						headers['Authorization'] = `Bearer ${this.props.bearerToken}`;
					}

					if (withAllLinks) {
						headers['X-With-Links-Summary'] = 'all';
					}

					if (withAllImages) {
						headers['X-With-Images-Summary'] = 'true';
					} else {
						headers['X-Retain-Images'] = 'none';
					}

					const response = await fetch('https://r.jina.ai/', {
						method: 'POST',
						headers,
						body: JSON.stringify({ url: normalizedUrl }),
					});

					if (!response.ok) {
						return {
							content: [
								{
									type: "text",
									text: `Error: Failed to convert URL - ${response.status} ${response.statusText}`,
								},
							],
						};
					}

					const data = await response.json() as any;
					
					if (!data.data) {
						return {
							content: [
								{
									type: "text",
									text: "Error: Invalid response data from r.jina.ai",
								},
							],
						};
					}

					const responseContent = [];
					
					// Add main content
					if (data.data.content) {
						responseContent.push({
							type: "text" as const,
							text: String(data.data.content),
						});
					}

					// Add structured data as JSON if requested via parameters
					const structuredData: any = {};
					
					if (data.data.url) {
						structuredData.url = data.data.url;
					}
					
					if (data.data.title) {
						structuredData.title = data.data.title;
					}

					if (withAllLinks && data.data.links) {
						// Transform links from [anchorText, url] arrays to {anchorText, url} objects
						structuredData.links = data.data.links.map((link: [string, string]) => ({
							anchorText: link[0],
							url: link[1]
						}));
					}

					if (withAllImages && data.data.images) {
						structuredData.images = data.data.images;
					}

					// Add structured data if any exists
					if (Object.keys(structuredData).length > 0) {
						responseContent.push({
							type: "text" as const,
							text: JSON.stringify(structuredData, null, 2),
						});
					}

					return {
						content: responseContent.length > 0 ? responseContent : [
							{
								type: "text" as const,
								text: "No content available",
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			},
		);
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

		return new Response("Not found", { status: 404 });
	},
};
