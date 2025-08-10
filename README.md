# Jina AI Remote MCP Server

A remote Model Context Protocol (MCP) server that provides access to Jina Reader, Embeddings and Reranker APIs including URL-to-markdown, web search, image search, and embeddings/reranker toolings.

For client that supports remote MCP server:
```json
{
  "mcpServers": {
    "jina-mcp-server": {
      "url": "https://mcp.jina.ai/sse",
      "headers": {
        "Authorization": "Bearer ${JINA_API_KEY}" // optional
      }
    }
  }
}
```

For client that does not support remote MCP server yet (Claude Desktop), you need [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) local proxy to connect to the remote MCP server.

```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": [
        "mcp-remote", 
        "https://mcp.jina.ai/sse"
        // optional bearer token
        "--header",
        "Authorization: Bearer ${JINA_API_KEY}"
        ]
    }
  }
}
```

This MCP server provides the following tools:

| Tool | Description | Is Jina API Key Required? |
|-----------|-------------|----------------------|
| `read_url` | Extract clean, structured content from web pages as markdown | Optional* |
| `capture_screenshot_url` | Capture high-quality screenshots of web pages | Optional* |
| `search_web` | Search the entire web for current information and news | Yes |
| `search_arxiv` | Search academic papers and preprints on arXiv repository | Yes |
| `search_image` | Search for images across the web (similar to Google Images) | Yes |

> Optional tools work without an API key but have [rate limits](https://jina.ai/api-dashboard/rate-limit). For higher rate limits and better performance, use a Jina API key. You can get a free Jina API key from [https://jina.ai](https://jina.ai)


## Developer Guide

### Deploy to Cloudflare Workers

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jina-ai/MCP)

This will deploy your MCP server to a URL like: `jina-mcp-server.<your-account>.workers.dev/sse`

### Local Development

```bash
# Clone the repository
git clone https://github.com/jina-ai/MCP.git
cd MCP

# Install dependencies
npm install

# Start development server
npm run start
```


## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.