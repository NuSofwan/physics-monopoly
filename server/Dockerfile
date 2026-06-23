FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm install
COPY . .
ENV PORT=2567
EXPOSE 2567
CMD ["npm", "run", "start", "-w", "server"]
