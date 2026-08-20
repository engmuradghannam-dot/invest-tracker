FROM node:20-alpine

WORKDIR /app

RUN npm install -g prisma

COPY server/package.json server/package-lock.json* ./
RUN npm install --production

COPY server/ ./
RUN npx prisma generate

COPY client/dist ./client/dist
RUN mkdir -p /tmp/uploads

EXPOSE 4000

CMD ["node", "src/index.js"]
