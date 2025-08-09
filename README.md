# Jina AI Remote MCP Server

A remote Model Context Protocol (MCP) server built on Cloudflare Workers that provides access to Jina AI's powerful web services including web reading, screenshot capture, web search, grounding, and embeddings generation.

## Features

🌐 **Web Reading**: Extract clean, structured content from any webpage  
📸 **Screenshot Capture**: Take high-quality screenshots of web pages  
🔍 **Web Search**: Perform intelligent web searches with advanced filtering  
🎯 **Grounding**: Verify and fact-check information against reliable sources  
🧠 **Embeddings**: Generate semantic embeddings for text content  
🔧 **Debug Tools**: Built-in API key management and debugging utilities  

## Quick Start

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
npm run dev
```

## Configuration

### Environment Variables

Set your Jina AI API key in your Cloudflare Workers environment:

```bash
# Using Wrangler CLI
wrangler secret put JINA_API_KEY
```

Or add it to your `wrangler.toml`:

```toml
[vars]
JINA_API_KEY = "your-jina-api-key-here"
```

### Available Tools

The server provides the following MCP tools:

- **`show_api_key`**: Debug tool to verify API key configuration
- **`capture_screenshot_url`**: Capture screenshots of web pages
- **`read_url`**: Extract clean content from web pages
- **`search_web`**: Perform web searches with advanced options
- **`get_grounding`**: Fact-check and verify information
- **`generate_embeddings`**: Create semantic embeddings for text

## Connect to Claude Desktop

To use this MCP server with Claude Desktop, add the following configuration to your Claude settings:

1. Go to Settings > Developer > Edit Config in Claude Desktop
2. Add this configuration:

```json
{
  "mcpServers": {
    "jina-ai": {
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

## Connect to Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL
3. Start using Jina AI tools directly from the playground!

## API Documentation

For detailed information about Jina AI's APIs, visit:
- [Jina AI Documentation](https://docs.jina.ai/)
- [Reader API](https://docs.jina.ai/reader/)
- [Search API](https://docs.jina.ai/search/)
- [Embeddings API](https://docs.jina.ai/embeddings/)

## Development

### Project Structure

```
src/
├── index.ts              # Main MCP server setup
├── tools/
│   └── jina-tools.ts     # Jina AI tool implementations
└── utils/
    ├── api-error-handler.ts  # API error handling utilities
    └── url-normalizer.ts     # URL processing utilities
```

### Adding Custom Tools

To add your own tools to the MCP server, modify the `registerJinaTools()` function in `src/tools/jina-tools.ts`:

```typescript
server.tool(
  "your_tool_name",
  "Description of what your tool does",
  {
    // Define your tool's input schema using Zod
    parameter: z.string().describe("Parameter description")
  },
  async ({ parameter }) => {
    // Implement your tool logic here
    return {
      content: [
        {
          type: "text" as const,
          text: "Your tool's response"
        }
      ]
    };
  }
);
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Support

For support and questions:
- [Jina AI Community](https://discord.jina.ai/)
- [GitHub Issues](https://github.com/jina-ai/MCP/issues)
- [Jina AI Documentation](https://docs.jina.ai/)