import * as vscode from 'vscode';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Converts VS Code LanguageModelChatMessage array to Anthropic messages format.
 * All messages are treated as user-turn since PM prompts combine system + user into one.
 */
function toAnthropicMessages(messages: vscode.LanguageModelChatMessage[]): AnthropicMessage[] {
  return messages.map((m, i) => ({
    // Alternate user/assistant if multiple messages; single-message prompts are always user.
    role: i % 2 === 1 ? 'assistant' : 'user',
    content: m.content
      .map((part) => (part instanceof vscode.LanguageModelTextPart ? part.value : ''))
      .join(''),
  }));
}

/**
 * Calls the Anthropic Messages API directly using fetch.
 * Returns the full text response.
 * Throws if the API key is missing, the request fails, or the response is malformed.
 */
export async function callAnthropic(messages: vscode.LanguageModelChatMessage[]): Promise<string> {
  const cfg = vscode.workspace.getConfiguration('orchestrator');
  const apiKey = cfg.get<string>('anthropicApiKey', '').trim();
  if (!apiKey) {
    throw new Error(
      'No AI model available. Add your Anthropic API key in Settings → "orchestrator.anthropicApiKey", ' +
      'then try again. Get a key at https://console.anthropic.com/'
    );
  }
  const model = cfg.get<string>('anthropicModel', 'claude-3-5-sonnet-20241022').trim();
  const anthropicMessages = toAnthropicMessages(messages);

  const body = JSON.stringify({
    model,
    max_tokens: 4096,
    messages: anthropicMessages,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = data.content
    ?.filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');

  if (!text) {
    throw new Error('Anthropic API returned an empty response.');
  }
  return text;
}
