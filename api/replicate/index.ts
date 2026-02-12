
// COMPATIBILITY ROUTE: /api/replicate
// This handles requests if the environment routes /api/* to this file (Pages Router style).

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export default async function handler(req: any, res: any) {
  // 1. SET CORS HEADERS IMMEDIATELY
  // These are critical for the browser to allow the response to be read.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-replicate-token'
  );

  // 2. HANDLE PREFLIGHT (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 3. EXTRACT API TOKEN
    // Priority: Server Env > Client Header
    let apiKey = process.env.REPLICATE_API_TOKEN;
    const clientHeader = req.headers['x-replicate-token'];
    
    if (!apiKey && clientHeader) {
       apiKey = Array.isArray(clientHeader) ? clientHeader[0] : clientHeader;
    }

    if (!apiKey) {
      return res.status(401).json({ error: "Missing API Token. Please set it in Settings." });
    }

    // 4. HANDLE POST (Create Prediction)
    if (req.method === 'POST') {
      const { model, input } = req.body || {};
      
      if (!model || !input) {
        return res.status(400).json({ error: "Invalid Payload: Missing model or input" });
      }

      // Construct Replicate URL
      // Logic: If model has a slash (owner/name), use that.
      const targetUrl = `${REPLICATE_API_BASE}/models/${model}/predictions`;
      
      console.log(`[Proxy] POST to ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
          "Prefer": "wait"
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Proxy] Replicate Error: ${errText}`);
        return res.status(response.status).json({ error: errText });
      }

      const data = await response.json();
      return res.status(201).json({ prediction: data });
    } 
    
    // 5. HANDLE GET (Check Status)
    else if (req.method === 'GET') {
      const { id } = req.query;
      
      if (!id) {
         return res.status(400).json({ error: "Missing ID" });
      }

      const response = await fetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
         const errText = await response.text();
         return res.status(response.status).json({ error: errText });
      }

      const data = await response.json();
      return res.status(200).json({ prediction: data });
    }

    else {
      res.status(405).json({ error: "Method Not Allowed" });
    }

  } catch (error: any) {
    console.error("[Proxy] Internal Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
