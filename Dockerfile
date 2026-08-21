FROM node:20-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm install --production

COPY server/ ./
COPY client/dist ./client/dist

RUN mkdir -p /tmp/uploads

EXPOSE 4000

CMD ["node", "minimal.js"]
