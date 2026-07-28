export default async function handler(req, res) {
  // 1. Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Set CORS header for standard POST responses
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 2. Validate API key presence
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const rawMessages = req.body.messages || [];

    // Separate system messages from user/assistant messages
    let systemPrompt = req.body.system || undefined;
    const cleanMessages = [];

    for (const msg of rawMessages) {
      if (msg.role === 'system') {
        if (typeof msg.content === 'string') {
          systemPrompt = msg.content;
        } else if (Array.isArray(msg.content)) {
          systemPrompt = msg.content;
        }
      } else {
        cleanMessages.push(msg);
      }
    }

    // Prepare payload for Anthropic API
    const payload = {
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      ...req.body,
      messages: cleanMessages
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    // 3. Forward request to Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
