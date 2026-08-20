# ── Build stage ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy and install client
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

# Copy client source and build
COPY client/ ./client/
RUN cd client && npm run build

# ── Production stage ──
FROM node:20-alpine

WORKDIR /app

# Install prisma CLI globally
RUN npm install -g prisma

# Copy server source first (includes prisma schema)
COPY server/ ./

# Install dependencies (including dev deps for prisma generate)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy built client from builder
COPY --from=builder /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p /tmp/uploads

# Expose port
EXPOSE 4000

# Start with retry logic for database
CMD ["sh", "-c", "echo Waiting for database... && sleep 5 && npx prisma db push && echo Starting server... && node src/index.js"]
