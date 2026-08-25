FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p storage/documents

EXPOSE 4002

CMD ["node", "index.js"]
