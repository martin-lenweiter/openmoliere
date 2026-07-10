import Anthropic from "@anthropic-ai/sdk";

// We route Anthropic Messages API calls through OpenRouter's Anthropic-compatible
// endpoint ("Anthropic Skin"). Streaming, thinking blocks, and tool use pass
// through unchanged; only the base URL, credential, and model slugs differ.
export const client = new Anthropic({
	apiKey: process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_API_KEY,
	baseURL: "https://openrouter.ai/api",
});

// OpenRouter model slug. Override with OPENROUTER_MODEL to pin a specific model.
export const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";
