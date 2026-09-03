FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY bridge.js .
EXPOSE 3002
CMD ["node", "bridge.js"]
