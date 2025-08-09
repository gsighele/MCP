# Jina AI Remote MCP Server

A remote Model Context Protocol (MCP) server that provides access to Jina Reader, Embeddings and Reranker APIs including URL-to-markdown, web search, image search, and embeddings/reranker toolings.

The server provides the following MCP tools:

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

## Connect to Claude Desktop

To use this MCP server with Claude Desktop, add the following configuration to your Claude settings:

1. Go to Settings > Developer > Edit Config in Claude Desktop
2. Add this configuration:

```json
{
  "mcpServers": {
    "jina-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://jina-mcp-server.your-account.workers.dev/sse"
      ],
      "env": {
        "JINA_API_KEY": "your-jina-api-key-here"
      }
    }
  }
}
```

3. Restart Claude Desktop


## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.