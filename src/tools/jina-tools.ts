import { z } from "zod";
import { stringify as yamlStringify } from "yaml";
import { normalizeUrl } from "../utils/url-normalizer.js";
import { handleApiError, checkBearerToken } from "../utils/api-error-handler.js";
import { lazyGreedySelection, lazyGreedySelectionWithSaturation } from "../utils/submodular-optimization.js";

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

	// Sort by relevance tool - rerank documents using Jina reranker API
	server.tool(
		"sort_by_relevance",
		"Rerank a list of documents by relevance to a query using Jina Reranker API. Use this when you have multiple documents and want to sort them by how well they match a specific query or topic. Perfect for document retrieval, content filtering, or finding the most relevant information from a collection. Returns documents sorted by relevance score.",
		{
			query: z.string().describe("The query or topic to rank documents against (e.g., 'machine learning algorithms', 'climate change solutions')"),
			documents: z.array(z.string()).describe("Array of document texts to rerank by relevance"),
			top_n: z.number().optional().describe("Maximum number of top results to return (default: all documents)")
		},
		async ({ query, documents, top_n }: { query: string; documents: string[]; top_n?: number }) => {
			try {
				const props = getProps();

				const tokenError = checkBearerToken(props.bearerToken);
				if (tokenError) {
					return tokenError;
				}

				if (documents.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No documents provided for reranking",
							},
						],
						isError: true,
					};
				}

				const response = await fetch('https://api.jina.ai/v1/rerank', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${props.bearerToken}`,
					},
					body: JSON.stringify({
						model: 'jina-reranker-v2-base-multilingual',
						query,
						top_n: top_n || documents.length,
						documents
					}),
				});

				if (!response.ok) {
					return handleApiError(response, "Document reranking");
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

	// Deduplicate strings tool - get top-k unique strings using embeddings and submodular optimization
	server.tool(
		"deduplicate_strings",
		"Get top-k semantically unique strings from a list using Jina embeddings and submodular optimization. Use this when you have many similar strings and want to select the most diverse subset that covers the semantic space. Perfect for removing duplicates, selecting representative samples, or finding diverse content. Returns the selected strings with their indices.",
		{
			strings: z.array(z.string()).describe("Array of strings to deduplicate"),
			k: z.number().optional().describe("Number of unique strings to return. If not provided, automatically finds optimal k by looking at diminishing return")
		},
		async ({ strings, k }: { strings: string[]; k?: number }) => {
			try {
				const props = getProps();

				const tokenError = checkBearerToken(props.bearerToken);
				if (tokenError) {
					return tokenError;
				}

				if (strings.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No strings provided for deduplication",
							},
						],
						isError: true,
					};
				}

				if (k !== undefined && (k <= 0 || k > strings.length)) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Invalid k value: ${k}. Must be between 1 and ${strings.length}`,
							},
						],
						isError: true,
					};
				}

				// Get embeddings from Jina API
				const response = await fetch('https://api.jina.ai/v1/embeddings', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${props.bearerToken}`,
					},
					body: JSON.stringify({
						model: 'jina-embeddings-v3',
						task: 'text-matching',
						input: strings
					}),
				});

				if (!response.ok) {
					return handleApiError(response, "Getting embeddings");
				}

				const data = await response.json() as any;

				if (!data.data || !Array.isArray(data.data)) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Invalid response format from embeddings API",
							},
						],
						isError: true,
					};
				}

				// Extract embeddings
				const embeddings = data.data.map((item: any) => item.embedding);

				// Use submodular optimization to select diverse strings
				let selectedIndices: number[];
				let optimalK: number;
				let values: number[];

				if (k !== undefined) {
					// Use specified k
					selectedIndices = lazyGreedySelection(embeddings, k);
					values = [];
				} else {
					// Automatically find optimal k using saturation point
					const result = lazyGreedySelectionWithSaturation(embeddings);
					selectedIndices = result.selected;
					values = result.values;
				}

				// Get the selected strings
				const selectedStrings = selectedIndices.map(idx => ({
					index: idx,
					text: strings[idx]
				}));

				return {
					content: [
						{
							type: "text" as const,
							text: yamlStringify({
								// values: values,
								deduplicated_strings: selectedStrings,
							}),
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

	// Deduplicate images tool - get top-k unique images using image embeddings and submodular optimization
	server.tool(
		"deduplicate_images",
		"Get top-k semantically unique images (URLs or base64-encoded) using Jina CLIP v2 embeddings and submodular optimization. Use this when you have many visually similar images and want the most diverse subset. Returns selected images as PNG base64-encoded images.",
		{
			images: z.array(z.string()).describe("Array of image inputs to deduplicate. Each item can be either an HTTP(S) URL or a raw base64-encoded image string (without data URI prefix)."),
			k: z.number().optional().describe("Number of unique images to return. If not provided, automatically finds optimal k by looking at diminishing return"),
		},
		async ({ images, k }: { images: string[]; k?: number }) => {
			try {
				const props = getProps();

				const tokenError = checkBearerToken(props.bearerToken);
				if (tokenError) {
					return tokenError;
				}

				if (images.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No images provided for deduplication",
							},
						],
						isError: true,
					};
				}

				if (k !== undefined && (k <= 0 || k > images.length)) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Invalid k value: ${k}. Must be between 1 and ${images.length}`,
							},
						],
						isError: true,
					};
				}

				// Prepare input for image embeddings API
				const embeddingInput = images.map((img) => ({ image: img }));

				// Get image embeddings from Jina API using CLIP v2
				const response = await fetch('https://api.jina.ai/v1/embeddings', {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${props.bearerToken}`,
					},
					body: JSON.stringify({
						model: 'jina-clip-v2',
						input: embeddingInput,
					}),
				});

				if (!response.ok) {
					return handleApiError(response, "Getting image embeddings");
				}

				const data = await response.json() as any;

				if (!data.data || !Array.isArray(data.data)) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Invalid response format from embeddings API",
							},
						],
						isError: true,
					};
				}

				// Extract embeddings
				const embeddings = data.data.map((item: any) => item.embedding);

				// Use submodular optimization to select diverse images
				let selectedIndices: number[];
				let values: number[];

				if (k !== undefined) {
					selectedIndices = lazyGreedySelection(embeddings, k);
					values = [];
				} else {
					const result = lazyGreedySelectionWithSaturation(embeddings);
					selectedIndices = result.selected;
					values = result.values;
				}

				// Get the selected images
				const selectedImages = selectedIndices.map((idx) => ({ index: idx, source: images[idx] }));


				const contentItems: Array<{ type: 'image'; data: string; mimeType?: string } | { type: 'text'; text: string }> = [];

				for (const { index, source } of selectedImages) {
					try {
						if (/^https?:\/\//i.test(source)) {
							// Try to leverage Cloudflare Image Resizing to transcode to PNG when available
							let imgResp = await fetch(source, {
								// @ts-ignore
								cf: { image: { format: 'png' } }
							} as any);
							if (!imgResp.ok) {
								// Fallback to plain fetch if resizing is not available
								imgResp = await fetch(source);
							}
							if (!imgResp.ok) {
								contentItems.push({ type: 'text', text: `Failed to download image at index ${index}: HTTP ${imgResp.status}` });
								continue;
							}
							const arrayBuf = await imgResp.arrayBuffer();
							const base64Data = Buffer.from(arrayBuf).toString('base64');
							contentItems.push({ type: 'image', data: base64Data, mimeType: 'image/png' });
						} else {
							// Treat as raw base64 without data URI; return as PNG by contract
							contentItems.push({ type: 'image', data: source, mimeType: 'image/png' });
						}
					} catch (e) {
						contentItems.push({ type: 'text', text: `Error processing image at index ${index}: ${e instanceof Error ? e.message : String(e)}` });
					}
				}

				return { content: contentItems.length > 0 ? contentItems : [{ type: 'text' as const, text: 'No images to return' }] };
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
