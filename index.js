console.log("Starting dinolingo backend ....");

import { serve } from "bun";
import { stringify } from "querystring";

const SLACK_CLIENT_ID = Bun.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = Bun.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = Bun.env.SLACK_REDIRECT_URI;
const PORT = Bun.env.DINOPORT;

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/oauth/start") {
      return startOAuth();
    } else if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });
      return handleOAuthCallback(code);
    }
    return new Response("Not Found", { status: 404 });
  },
});

// Start OAuth flow by redirecting to Slack's OAuth URL
function startOAuth() {
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?${stringify({
    client_id: SLACK_CLIENT_ID,
    redirect_uri: SLACK_REDIRECT_URI,
    scope: "identity.avatar,identity.basic",
    state: "unique_state_token", // for CSRF protection
  })}`;

  return Response.redirect(slackAuthUrl, 302);
}

// Handle OAuth callback and exchange code for access token
async function handleOAuthCallback(code) {
  try {
    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: stringify({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.ok) {
      const { access_token, team } = tokenData;
      return new Response(JSON.stringify({ access_token, team }), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("Error from Slack:", tokenData.error);
      return new Response(`OAuth failed: ${tokenData.error}`, { status: 400 });
    }
  } catch (error) {
    console.error("Error during token exchange:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
