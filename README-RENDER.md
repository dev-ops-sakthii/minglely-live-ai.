# Deploy Minglely to Render

The project is configured as a Render Blueprint in `render.yaml` and uses the Free web-service plan.

1. Push the project to GitHub.
2. In Render, select **New → Blueprint** and connect the repository.
3. Review `minglely-chat`, confirm the Free plan, then apply the Blueprint.
4. Wait for `/health` to pass, then use the generated `onrender.com` URL.

The service deploys Node 24 with `npm ci` and `npm start`. It sleeps after 15 minutes without traffic and can take about a minute to wake. Restarts clear the in-memory matchmaking queue. Use it for a demo, not reliable production hosting.

## Before public launch

Add durable, staffed report/moderation and blocking flows; privacy/terms and a retention policy; actual age assurance; monitoring and abuse controls; and a TURN service for reliable video. Reports currently appear only in process logs. The browser's scripted demo conversation is not a live AI model. The 18+ checkbox is not age verification. Complete legal and safety review before inviting the public.
