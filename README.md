
# 🎥 WalTube

**Decentralized YouTube alternative powered by Web3, decentralized storage, and blazing-fast performance.**

WalTube is a decentralized video streaming platform built using **Next.js 14**, **Tusky**, and **Privy**. It enables users to upload, store, and stream high-quality videos with **full ownership**, **secure wallet-based authentication**, and **distributed content delivery**—all through a sleek, responsive UI.

---

## 🚀 Features

### 🧑‍💻 Web3 Authentication
- Built-in **Privy SDK** for seamless login with MetaMask, WalletConnect, and more.
- Secure session handling using environment variable-based token configuration.
- Web2-style onboarding for both crypto-native and non-crypto users.

### 📁 Decentralized Storage
- Integrates with **Tusky SDK** for:
  - Cost-efficient, distributed video storage.
  - Seamless video retrieval with automatic quality fallback.
  - Backend routing via custom `/api/tusky` endpoints.

### 📺 Advanced Video Player
- Built from scratch using native HTML5 APIs.
- Fullscreen mode, keyboard shortcuts (`F`, `Esc`), and custom controls.
- Visual seekbar, buffer indicators, and volume/mute toggles.
- **Supports MP4** and **HLS streaming**, including adaptive quality (360p to 1080p).

### ⚙️ Streaming & Performance
- Real-time stats & streaming health.
- Dynamic routing with **App Router** and URL-based video loading.
- **Suspense boundaries** for async loading and smooth navigation.
- Optimized buffer & seek restoration.

### 🎨 Modern UI
- Responsive layout with **Tailwind CSS**.
- Mobile-friendly video experience.
- Minimalistic design optimized for user engagement.

### 🛠 Deployment
- Production-ready deployment via **Vercel**.
- Environment-secured API keys.
- ESLint + TypeScript for robust developer experience.

---

## 🔐 Tech Stack

| Feature             | Stack                             |
|---------------------|------------------------------------|
| Frontend Framework  | Next.js 14 (App Router)            |
| Styling             | Tailwind CSS                      |
| Auth                | Privy SDK                         |
| Storage             | Tusky SDK                         |
| Language            | TypeScript                        |
| Hosting             | Vercel                            |
| Video Formats       | MP4, HLS                          |

---

## 🧠 Why WalTube?

- **No platform lock-in**: Your content lives on decentralized infrastructure.
- **No ads or surveillance**: You control the content. Not algorithms.
- **Web3-native, Web2-smooth**: Seamless login, real-time playback, and blazing UX.

---

## 📦 Local Development

```bash
# Install dependencies
yarn install

# Run dev server
yarn dev
```

Environment variables:

```
PRIVY_APP_ID=...
TUSKY_API_KEY=...
NEXT_PUBLIC_TUSKY_GATEWAY_URL=https://...
```

---

## 🧪 Roadmap

- [x] Web3 Login via Privy
- [x] Upload and playback via Tusky
- [x] Multi-resolution support
- [x] Responsive design
- [ ] Comments and likes
- [ ] Creator analytics dashboard
- [ ] NFT video publishing (future)

---

## 📸 Preview

> Coming soon…

---
