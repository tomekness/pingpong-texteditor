FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY server.js .
VOLUME ["/data"]
EXPOSE 1234
CMD ["node", "server.js"]
