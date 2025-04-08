import { readFileSync } from "node:fs";

// mycoder.config.js
export default {
	// GitHub integration
	githubMode: true,

	// Browser settings
	headless: true,
	userSession: false,

	// System browser detection settings
	browser: {
		// Whether to use system browsers or Playwright's bundled browsers
		useSystemBrowsers: true,

		// Preferred browser type (chromium, firefox, webkit)
		preferredType: "chromium",

		// Custom browser executable path (overrides automatic detection)
		// executablePath: null, // e.g., '/path/to/chrome'
	},

	// Model settings
	provider: "openai",
	model: "gemini-2.5-pro-preview-03-25",
	maxTokens: 1048576,
	temperature: 0.7,

	// Custom settings
	// customPrompt can be a string or an array of strings for multiple lines
	customPrompt: `
        Please follow the instructions in the CAUDE.md file:
        ${readFileSync("../CAUDE.md", "utf-8")}
    `,
	// Example of multiple line custom prompts:
	// customPrompt: [
	//   'Custom instruction line 1',
	//   'Custom instruction line 2',
	//   'Custom instruction line 3',
	// ],
	profile: false,

	// Base URL configuration (for providers that need it)
	baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", // Example for Ollama

	// MCP configuration
	mcp: {
		/* 
        servers: [
			{
				name: "example",
				url: "https://mcp.example.com",
				auth: {
					type: "bearer",
					token: "your-token-here",
				},
			},
		],
		defaultResources: ["example://docs/api"],
		defaultTools: ["example://tools/search"],
        */
	},
};
