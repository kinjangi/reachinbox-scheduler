FROM node:20 AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production image
FROM node:20

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
# Install only production dependencies
RUN npm ci --only=production
# Generate Prisma client for runtime
RUN npx prisma generate

# Copy built code
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Start the server (run migrations first, then start dist/index.js)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
