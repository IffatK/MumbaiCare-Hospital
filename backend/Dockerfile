FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["sh","-c","node dist/scripts/migrate.js && node dist/scripts/seed.js && node dist/index.js"]
