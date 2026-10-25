# Deploy Minglely to Render

The project is configured as a Render Blueprint in `render.yaml`.

1. Push the project to GitHub.
2. In Render, select **New → Blueprint** and connect the repository.
3. Review `minglely-chat` and confirm the paid 1 CPU / 2 GB plan before applying the Blueprint.
4. Wait for `/health` to pass, then use the service's generated `onrender.com` URL.
5. Add an optional custom domain from the service settings.

The Blueprint deploys Node 24 with `npm ci` and `npm start`, enables commit-based auto-deploys, and checks `/health`. Render supports WebSockets over the web service's HTTPS endpoint. The service intentionally runs one instance because its matchmaking queue is in memory. Shared Redis/Key Value storage and reconnection handling are required before horizontal scaling.

## Before public launch

This deploy is a single-instance beta foundation. Add durable, staffed report/moderation and blocking flows; privacy/terms and a retention policy; actual age assurance; monitoring and abuse controls; and a TURN service for reliable video. Reports currently appear only in process logs. The browser's scripted demo conversation is not a live AI model. The 18+ checkbox is not age verification. Complete legal and safety review before inviting the public.

