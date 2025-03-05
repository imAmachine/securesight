# Stage 1: Build the React app using Node.js and NPM
FROM node:16-alpine AS build

WORKDIR /app/frontend

# Copy package files first
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci --silent

# Copy the rest of the frontend files
COPY frontend/ .

# Build the application
RUN npm run build

# Stage 2: Serve the built app using NGINX
FROM nginx:alpine

# Copy built app from build stage
COPY --from=build /app/frontend/build /usr/share/nginx/html

# Copy NGINX configuration (ensure this file exists)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]