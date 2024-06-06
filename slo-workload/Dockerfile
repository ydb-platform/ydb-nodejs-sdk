FROM node:current

# build actual SDK
WORKDIR /workload
COPY ./package* ./
RUN npm install
COPY ./ .
RUN NODE_ENV=production npm run build

# build slo-workload
# SLO test is built after SDK because it depends on it
WORKDIR /workload/slo-workload
RUN npm install
RUN NODE_ENV=production npm run build

# run slo-workload
ENTRYPOINT ["npm", "run", "start", "--"]
