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

    // Build payload for Anthropic API
    const payload = {
      ...req.body,
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: cleanMessages
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    // Clean up non-Anthropic request parameters if sent by frontend
    delete payload.temperature;
    delete payload.top_p;
    delete payload.top_k;

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
      // If Anthropic returns an error, return it as JSON with error message formatted
      const errMsg = data.error?.message || data.error || JSON.stringify(data);
      return res.status(response.status).json({ error: errMsg, message: errMsg });
    }

    // Safely extract output string
    let replyText = '';
    if (data.content && Array.isArray(data.content)) {
      replyText = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');
    } else if (typeof data.content === 'string') {
      replyText = data.content;
    }

    // 4. Return response supporting ALL common frontend message parsing patterns
    return res.status(200).json({
      ...data,
      text: replyText,
      reply: replyText,
      message: replyText,
      content: replyText,
      choices: [
        {
          text: replyText,
          message: {
            role: 'assistant',
            content: replyText
          }
        }
      ]
    });
  } catch (error) {
    return res.status(500).json({ error: error.message, message: error.message });
  }
}
