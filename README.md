# Minglely

A real-time stranger-chat app with text chat and WebRTC video, language-based matching, a basic 18+ confirmation, and a clearly disclosed scripted demo conversation. It is not affiliated with uMingle.

## Run locally

Requires Node.js 22 or 24.

```sh
npm ci
npm start
```

Open `http://localhost:3000` in two browser sessions. Camera and microphone access require localhost or HTTPS.

## Deploy to Render

This repository includes a Render Blueprint in `render.yaml`. To deploy:

1. Push this project to a GitHub repository.
2. In Render, choose **New → Blueprint** and connect that repository.
3. Review the service named `minglely-chat` and confirm its paid 1 CPU / 2 GB plan, then apply the Blueprint.
4. Wait for the `/health` check to pass and open the generated `onrender.com` URL.
5. For a custom domain, add it in the Render service settings and follow Render's DNS instructions.

The Blueprint uses Node 24, `npm ci`, `npm start`, HTTPS provided by Render, WebSockets, and a health check. It intentionally uses one always-on instance because matchmaking state is held in memory. Do not increase the instance count until matchmaking has been moved to shared storage and reconnect behavior has been designed for it.

## Current production limits

This is a deployable single-instance beta foundation, not a fully production-ready public stranger-chat service. Before opening it to the public, complete and review:

- Persistent, staffed report handling, moderation and user blocking. Current reports only reach process logs and are not durable or reviewed.
- Privacy notice, terms, retention/deletion policy, and jurisdiction-specific legal review.
- Effective age assurance. The current checkbox is only a self-confirmation, not age verification.
- Shared queue/session state (for scaling), durable abuse controls, and monitoring/alerting.
- A TURN service and tested WebRTC connectivity across networks. The current client only configures a public STUN server.
- A real AI provider if AI conversations are intended. The current fallback is a local scripted demo with browser speech synthesis, not a live AI model or generated video.

Do not represent the current report flow, age checkbox, or scripted demo as human moderation, verified age, or an AI service.

