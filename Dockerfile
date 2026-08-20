FROM node:20-alpine

WORKDIR /app

# Install prisma CLI
RUN npm install -g prisma

# Copy server source
COPY server/package.json server/package-lock.json* ./
RUN npm install --production

COPY server/ ./

# Generate Prisma client
RUN npx prisma generate

# Copy pre-built static client
COPY client/dist ./client/dist

# Create uploads directory
RUN mkdir -p /tmp/uploads

# Expose port
EXPOSE 4000

# Start server directly (no db push here - Render handles DB setup)
CMD ["node", "src/index.js"]
