# ── Build stage ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY client/package.json client/package-lock.json* ./client/
COPY server/package.json server/package-lock.json* ./server/

# Install dependencies
RUN cd client && npm install
RUN cd server && npm install

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client
RUN cd client && npm run build

# ── Production stage ──
FROM node:20-alpine

WORKDIR /app

# Install prisma CLI for migrations
RUN npm install -g prisma

# Copy server package and install production deps
COPY server/package.json server/package-lock.json* ./
RUN npm install --production

# Copy server source
COPY server/ ./

# Copy built client from builder
COPY --from=builder /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p /tmp/uploads

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Expose port
EXPOSE 4000

# Start
CMD ["sh", "-c", "npx prisma db push && node src/index.js"]
