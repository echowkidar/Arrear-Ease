# Stage 1 — Install dependencies (clean, reproducible)
FROM node:20-slim AS deps

WORKDIR /app

COPY package*.json ./

# npm ci is safer than npm install — uses lockfile exactly, no surprises
RUN npm ci

# Stage 2 — Build the app
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ✅ Accept build args for Firebase config
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

# ✅ Set them as ENV so Next.js can bake them into the build
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

ENV NODE_ENV=production

RUN npm run build

# Stage 3 — Minimal runtime image (only what's needed to run)
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# ✅ Copy ONLY required artifacts — no stale files, no build cache, no hidden temp files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# ✅ Explicit host binding — fixes 504 "connection refused" from reverse proxy
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
