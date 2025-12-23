### STAGE 1 - Install dependencys #########################################
FROM node:19-alpine as compiled

# Create app directory
WORKDIR /usr/app

COPY *.json *.js *.html *.riot ./

RUN npm config set registry https://npm.bergauer.dev/repository/npm/
RUN npm i
RUN npm install --global http-server

ENTRYPOINT ["http-server"]
