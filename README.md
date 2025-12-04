# Photo Management App with MongoDB

A web application for uploading, tagging, organizing, and managing photos using MongoDB.

## Features
- Upload images with automatic embedding generation
- Auto-tagging (person_id, nature, pets, objects)
- CRUD operations (Create, Read, Update, Delete)
- Organize images into folders based on tags
- View stored data in MongoDB

## Setup Instructions

### 1. Install MongoDB
Make sure MongoDB is installed and running on your system.

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MongoDB connection string if needed
```

### 4. Start the Application
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

### 5. Access the Application
Open your browser and navigate to: `http://localhost:3000`

## API Endpoints

- `POST /api/upload` - Upload image with optional embedding
- `GET /api/images` - Get all images
- `GET /api/images/:id` - Get specific image
- `PUT /api/images/:id` - Update image tags
- `DELETE /api/images/:id` - Delete image
- `POST /api/organize` - Organize images into folders by tags

## Viewing Database Data

### Method 1: MongoDB Compass (GUI)
1. Download MongoDB Compass: https://www.mongodb.com/products/compass
2. Connect using: `mongodb://localhost:27017`
3. Navigate to database: `photo_app`
4. View collections: `images`

### Method 2: MongoDB Shell
```bash
mongosh
use photo_app
db.images.find().pretty()
```

### Method 3: Application API
```bash
curl http://localhost:3000/api/images
```
