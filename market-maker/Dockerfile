FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# Copy source files
COPY abi/ ./abi/
COPY *.ts ./

# Run the application with Node.js native TypeScript support
# Node 24+ supports --experimental-strip-types for running .ts files directly
CMD ["node", "--experimental-strip-types", "index.ts"]
