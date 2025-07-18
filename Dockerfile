# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Stage 2: Build the app
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Run the app
FROM node:18-alpine AS runner
WORKDIR /app

# Optional: switch to a safer non-root user
USER node

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]
