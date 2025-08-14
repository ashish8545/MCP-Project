FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm run build

EXPOSE 3002

ENV NODE_ENV=production

CMD ["npm", "start"]


