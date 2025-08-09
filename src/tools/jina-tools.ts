import { z } from "zod";
import { stringify as yamlStringify } from "yaml";
import { normalizeUrl } from "../utils/url-normalizer.js";
import { handleApiError, checkBearerToken } from "../utils/api-error-handler.js";

export function registerJinaTools(server: any, getProps: () => any) {
	// Show API key tool - returns the bearer token from request headers
	server.tool(
		"show_api_key",
		"Return the bearer token from the Authorization header of the MCP settings, which is used to debug.",
		{},
		async () => {
			const props = getProps();
			const token = props.bearerToken as string;
			if (!token) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No bearer token found in request",
						},
					],
					isError: true,
				};
			}
			return {
				content: [
					{
						type: "text" as const,
						text: token,
					},
				],
			};
		},
	);

	// Screenshot tool - captures web page screenshots
	server.tool(
		"capture_screenshot_url",
		"Capture high-quality screenshots of web pages. Use this tool when you need to visually inspect a website, take a snapshot for analysis, or show users what a webpage looks like. Returns the screenshot as a base64-encoded PNG image that can be displayed directly.",
		{
			url: z.string().url().describe("The complete HTTP/HTTPS URL of the webpage to capture (e.g., 'https://example.com')"),
			firstScreenOnly: z.boolean().optional().describe("Set to true for a single screen capture (faster), false for full page capture including content below the fold (default: false)")
		},
		async ({ url, firstScreenOnly }: { url: string; firstScreenOnly?: boolean }) => {
			try {
				const props = getProps();
				const headers: Record<string, string> = {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Return-Format': firstScreenOnly === true ? 'screenshot' : 'pageshot',
				};

				// Add Authorization header if bearer token is available
				if (props.bearerToken) {
					headers['Authorization'] = `Bearer ${props.bearerToken}`;
				}

				const response = await fetch('https://r.jina.ai/', {
					method: 'POST',
					headers,
					body: JSON.stringify({ url }),
				});

				if (!response.ok) {
					return handleApiError(response, "Screenshot capture");
				}

				const data = await response.json() as any;
				
				// Fetch and return the screenshot as base64-encoded image
				const imageUrl = data.data.screenshotUrl || data.data.pageshotUrl;
				if (imageUrl) {
					try {
						// Download the image from the URL
						const imageResponse = await fetch(imageUrl);
						if (!imageResponse.ok) {
													return {
							content: [
								{
									type: "text" as const,
									text: `Error: Failed to download screenshot from ${imageUrl}`,
								},
							],
							isError: true,
						};
						}

						// Convert to base64
						const imageBuffer = await imageResponse.arrayBuffer();
						const base64Image = Buffer.from(imageBuffer).toString('base64');

						return {
							content: [
								{
									type: "image" as const,
									data: base64Image,
									mimeType: "image/png",
								},
							],
						};
					} catch (downloadError) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Error downloading screenshot: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`,
								},
							],
							isError: true,
						};
					}
				} else {
					return {
						content: [
							{
								type: "text" as const,
								text: "Error: No screenshot URL received from API",
							},
						],
						isError: true,
					};
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	// Read URL tool - converts any URL to markdown via r.jina.ai
	server.tool(
		"read_url",
		"Extract and convert web page content to clean, readable markdown format. Perfect for reading articles, documentation, blog posts, or any web content. Use this when you need to analyze text content from websites, bypass paywalls, or get structured data. Returns clean markdown text plus optional metadata like links and images.",
		{ 
			url: z.string().url().describe("The complete URL of the webpage or PDF file to read and convert (e.g., 'https://example.com/article')"),
			withAllLinks: z.boolean().optional().describe("Set to true to extract and return all hyperlinks found on the page as structured data"),
			withAllImages: z.boolean().optional().describe("Set to true to extract and return all images found on the page as structured data")
		},
		async ({ url, withAllLinks, withAllImages }: { url: string; withAllLinks?: boolean; withAllImages?: boolean }) => {
			try {
				const props = getProps();
				// Normalize the URL first
				const normalizedUrl = normalizeUrl(url);
				if (!normalizedUrl) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Error: Invalid or unsupported URL",
							},
						],
						isError: true,
					};
				}

				const headers: Record<string, string> = {
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Md-Link-Style': 'discarded',
				};

				// Add Authorization header if bearer token is available
				if (props.bearerToken) {
					headers['Authorization'] = `Bearer ${props.bearerToken}`;
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
					return handleApiError(response, "URL conversion");
				}

				const data = await response.json() as any;
				
				if (!data.data) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Error: Invalid response data from r.jina.ai",
							},
						],
						isError: true,
					};
				}

				const responseContent = [];
			

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
						text: yamlStringify(structuredData),
					});
				}

				// Add main content
				if (data.data.content) {
					responseContent.push({
						type: "text" as const,
						text: String(data.data.content),
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
							type: "text" as const,
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	// Search Web tool - search the web using Jina Search API
	server.tool(
		"search_web",
		"Search the entire web for current information, news, articles, and websites. Use this when you need up-to-date information, want to find specific websites, research topics, or get the latest news. Ideal for answering questions about recent events, finding resources, or discovering relevant content. Returns structured search results with URLs, titles, and content snippets.",
		{
			query: z.string().describe("Search terms or keywords to find relevant web content (e.g., 'climate change news 2024', 'best pizza recipe')"),
			num: z.number().optional().describe("Maximum number of search results to return, between 1-100 (default: 30)")
		},
		async ({ query, num = 30 }: { query: string; num?: number }) => {
			try {
				const props = getProps();
				
				const tokenError = checkBearerToken(props.bearerToken);
				if (tokenError) {
					return tokenError;
				}

				const response = await fetch('https://svip.jina.ai/', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${props.bearerToken}`,
					},
					body: JSON.stringify({
						q: query,
						num
					}),
				});

				if (!response.ok) {
					return handleApiError(response, "Web search");
				}

				const data = await response.json() as any;
				

				return {
					content: [
						{
							type: "text" as const,
							text: yamlStringify(data.results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	// Search Arxiv tool - search arxiv papers using Jina Search API
	server.tool(
		"search_arxiv", 
		"Search academic papers and preprints on arXiv repository. Perfect for finding research papers, scientific studies, technical papers, and academic literature. Use this when researching scientific topics, looking for papers by specific authors, or finding the latest research in fields like AI, physics, mathematics, computer science, etc. Returns academic papers with URLs, titles, abstracts, and metadata.",
		{
			query: z.string().describe("Academic search terms, author names, or research topics (e.g., 'transformer neural networks', 'Einstein relativity', 'machine learning optimization')"),
			num: z.number().optional().describe("Maximum number of academic papers to return, between 1-100 (default: 30)")
		},
		async ({ query, num = 30 }: { query: string; num?: number }) => {
			try {
				const props = getProps();
				
				const tokenError = checkBearerToken(props.bearerToken);
				if (tokenError) {
					return tokenError;
				}

				const response = await fetch('https://svip.jina.ai/', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${props.bearerToken}`,
					},
					body: JSON.stringify({
						q: query,
						domain: 'arxiv',
						num
					}),
				});

				if (!response.ok) {
					return handleApiError(response, "arXiv search");
				}

				const data = await response.json() as any;
			

				return {
					content: [
						{
							type: "text" as const,
							text: yamlStringify(data.results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	// Search Image tool - search for images on the web using Jina Search API
	server.tool(
		"search_image",
		"Search for images across the web, similar to Google Images. Use this when you need to find photos, illustrations, diagrams, charts, logos, or any visual content. Perfect for finding images to illustrate concepts, locating specific pictures, or discovering visual resources. Returns image search results with URLs, titles, descriptions, and image metadata.",
		{
			query: z.string().describe("Image search terms describing what you want to find (e.g., 'sunset over mountains', 'vintage car illustration', 'data visualization chart')")
		},
		async ({ query }: { query: string }) => {
			try {
				const props = getProps();
				
				const tokenError = checkBearerToken(props.bearerToken);
				if (tokenError) {
					return tokenError;
				}

				const response = await fetch('https://svip.jina.ai/', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${props.bearerToken}`,
					},
					body: JSON.stringify({
						q: query,
						type: 'images',
					}),
				});

				if (!response.ok) {
					return handleApiError(response, "Image search");
				}

				const data = await response.json() as any;

				return {
					content: [
						{
							type: "text" as const,
							text: yamlStringify(data.results),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
