FROM node:lts-alpine AS build

# Make the 'app' folder the current working directory
WORKDIR /app

# Copy both 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy project files and folders to the current working directory (i.e., 'app' folder)
COPY . .

# Build app for production with minification
RUN npm run build

# Stage 2: Use Nginx to serve the built app
FROM nginx:alpine

# Copy the Nginx custom configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 8080
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
