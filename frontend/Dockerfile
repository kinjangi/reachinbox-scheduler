FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
# Set environment variable to enable standalone output for smaller images if preferred
ENV NEXT_TELEMETRY_DISABLED 1

# Note: In a real production build, NEXT_PUBLIC_API_URL should be provided here.
# For local docker-compose, we can pass it via env.
RUN npm run build

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Start Next.js
CMD ["npm", "start"]
