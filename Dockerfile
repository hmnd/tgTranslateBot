FROM node:alpine

WORKDIR /app

RUN apk add git

COPY package.json yarn.lock ./

RUN yarn --prod

COPY . .

CMD yarn start