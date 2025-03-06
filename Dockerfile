FROM node:18-alpine

WORKDIR /zra_compliance

COPY package*.json ./

RUN npm install --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
