FROM node:19.3.0

WORKDIR /workload
COPY package* ./
RUN npm install
COPY . .
RUN NODE_ENV=production npm run build

ENTRYPOINT ["npm", "run", "start", "--"]