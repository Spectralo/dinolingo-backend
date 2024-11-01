console.log("Starting dinolingo backend ....");

import { serve } from "bun";

const SLACK_CLIENT_ID = Bun.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = Bun.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = Bun.env.SLACK_REDIRECT_URI;
const PORT = Bun.env.DINOPORT;

if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET || !SLACK_REDIRECT_URI || !PORT) {
  throw new Error("Missing required environment variables");
}

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/oauth/start" && req.method === "GET") {
      return startOAuth();
    } else if (url.pathname === "/oauth/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });
      return handleOAuthCallback(code);
    }
    return new Response("Not Found", { status: 404 });
  },
});

// Start OAuth flow by redirecting to Slack's OAuth URL
function startOAuth() {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    redirect_uri: SLACK_REDIRECT_URI,
    scope: "profile,openid",
    response_type: "code",
  });

  const slackAuthUrl = `https://slack.com/openid/connect/authorize?${params.toString()}`;

  return Response.redirect(slackAuthUrl, 302);
}

// Handle OAuth callback and exchange code for access token
async function handleOAuthCallback(code) {
  try {
    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(
      "https://slack.com/api/openid.connect.token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.ok) {
      console.log(tokenData);
    } else {
      console.error("Error from Slack:", tokenData.error);
      return new Response(`OAuth failed: ${tokenData.error}`, { status: 400 });
    }
  } catch (error) {
    console.error("Error during token exchange:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
