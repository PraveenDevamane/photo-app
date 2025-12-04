const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
require('dotenv').config();

const Image = require('./models/Image');
const Person = require('./models/Person');
const Pet = require('./models/Pet');
const Nature = require('./models/Nature');
const Vehicle = require('./models/Vehicle');
const ImageProcessor = require('./services/imageProcessor');
const CollectionSync = require('./services/collectionSync');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/organized', express.static('organized'));

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const organizedDir = path.join(__dirname, 'organized');
fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(organizedDir);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/photo_app';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ========== ROUTES ==========

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload image with optional embedding
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Parse embedding from request (if provided)
    let embedding = [];
    if (req.body.embedding) {
      try {
        embedding = JSON.parse(req.body.embedding);
      } catch (e) {
        console.log('Invalid embedding format, generating simple one');
      }
    }

    // Generate embedding if not provided
    if (embedding.length === 0) {
      embedding = ImageProcessor.generateSimpleEmbedding(req.file.originalname);
    }

    // Parse custom tags
    let customTags = [];
    if (req.body.tags) {
      customTags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Analyze and auto-tag
    const autoTags = ImageProcessor.analyzeEmbedding(embedding, req.file.originalname);

    // Create image document
    const image = new Image({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: req.file.path,
      embedding: embedding,
      tags: customTags,
      autoTags: autoTags,
      metadata: {
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

    await image.save();

    // Sync to category collection
    await CollectionSync.addImageToCollection(image);

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: {
        id: image._id,
        filename: image.filename,
        originalName: image.originalName,
        tags: image.tags,
        autoTags: image.autoTags,
        uploadDate: image.uploadDate
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all images
app.get('/api/images', async (req, res) => {
  try {
    const { tag, person_id, nature, pets, organized } = req.query;
    
    let query = {};
    
    if (tag) {
      query.tags = tag;
    }
    if (person_id) {
      query['autoTags.person_id'] = person_id;
    }
    if (nature === 'true') {
      query['autoTags.nature'] = true;
    }
    if (pets === 'true') {
      query['autoTags.pets'] = true;
    }
    if (organized !== undefined) {
      query.organized = organized === 'true';
    }

    const images = await Image.find(query).sort({ uploadDate: -1 });
    
    res.json({
      count: images.length,
      images: images.map(img => ({
        id: img._id,
        filename: img.filename,
        originalName: img.originalName,
        url: `/uploads/${img.filename}`,
        tags: img.tags,
        autoTags: img.autoTags,
        organized: img.organized,
        organizedPath: img.organizedPath,
        uploadDate: img.uploadDate
      }))
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single image by ID
app.get('/api/images/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      id: image._id,
      filename: image.filename,
      originalName: image.originalName,
      url: `/uploads/${image.filename}`,
      embedding: image.embedding,
      tags: image.tags,
      autoTags: image.autoTags,
      organized: image.organized,
      organizedPath: image.organizedPath,
      uploadDate: image.uploadDate,
      metadata: image.metadata
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update image tags
app.put('/api/images/:id', async (req, res) => {
  try {
    const { tags, autoTags } = req.body;
    
    const updateData = {};
    
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(t => t);
    }
    
    if (autoTags !== undefined) {
      updateData.autoTags = autoTags;
    }

    const image = await Image.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      message: 'Image updated successfully',
      image: {
        id: image._id,
        tags: image.tags,
        autoTags: image.autoTags
      }
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete image
app.delete('/api/images/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Remove from category collections first
    await CollectionSync.removeImageFromCollections(image);

    // Delete file from filesystem
    if (fs.existsSync(image.filepath)) {
      fs.unlinkSync(image.filepath);
    }

    // Delete organized copy if exists
    if (image.organized && image.organizedPath && fs.existsSync(image.organizedPath)) {
      fs.unlinkSync(image.organizedPath);
    }

    // Delete from database
    await Image.findByIdAndDelete(req.params.id);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Organize images into folders based on tags - copies to ALL matching folders
app.post('/api/organize', async (req, res) => {
  try {
    const { imageId } = req.body;
    
    let imagesToOrganize;
    
    if (imageId) {
      // Organize single image
      const image = await Image.findById(imageId);
      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      imagesToOrganize = [image];
    } else {
      // Organize all unorganized images
      imagesToOrganize = await Image.find({ organized: false });
    }

    const results = [];

    for (const image of imagesToOrganize) {
      // Get ALL folder paths for this image
      const folderPaths = ImageProcessor.getAllFolderPaths(image.autoTags, image.tags);
      const organizedPaths = [];
      
      for (const folderPath of folderPaths) {
        const targetDir = path.join(organizedDir, folderPath);
        
        // Create directory if it doesn't exist
        fs.ensureDirSync(targetDir);
        
        // Copy file to organized folder
        const targetPath = path.join(targetDir, image.filename);
        fs.copyFileSync(image.filepath, targetPath);
        organizedPaths.push(targetPath);
      }
      
      // Update database with first path (for backward compatibility)
      image.organized = true;
      image.organizedPath = organizedPaths[0];
      await image.save();
      
      results.push({
        id: image._id,
        filename: image.filename,
        organizedTo: folderPaths // Return ALL folders
      });
    }

    res.json({
      message: `Successfully organized ${results.length} image(s)`,
      results: results
    });
  } catch (error) {
    console.error('Organize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const total = await Image.countDocuments();
    const organized = await Image.countDocuments({ organized: true });
    const withPeople = await Image.countDocuments({ 'autoTags.person_id': { $ne: null } });
    const withPets = await Image.countDocuments({ 'autoTags.pets': true });
    const withNature = await Image.countDocuments({ 'autoTags.nature': true });

    res.json({
      total,
      organized,
      unorganized: total - organized,
      categories: {
        people: withPeople,
        pets: withPets,
        nature: withNature
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Re-process all images with updated tagging logic
app.post('/api/reprocess', async (req, res) => {
  try {
    // Clear person store to start fresh
    ImageProcessor.clearPersonStore();
    
    // Clear all category collections
    await CollectionSync.clearAllCollections();
    
    // Get all images
    const images = await Image.find().sort({ uploadDate: 1 });
    const results = [];

    for (const image of images) {
      // Re-generate embedding if needed
      let embedding = image.embedding;
      if (!embedding || embedding.length === 0) {
        embedding = ImageProcessor.generateSimpleEmbedding(image.originalName);
      }

      // Re-analyze with new logic
      const autoTags = ImageProcessor.analyzeEmbedding(embedding, image.originalName);

      // Update image
      image.embedding = embedding;
      image.autoTags = autoTags;
      image.organized = false; // Mark for re-organization
      image.organizedPath = null;
      await image.save();

      // Sync to category collection
      await CollectionSync.addImageToCollection(image);

      results.push({
        id: image._id,
        filename: image.originalName,
        newTags: autoTags
      });
    }

    res.json({
      message: `Re-processed ${results.length} image(s)`,
      results: results
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset and reorganize all images - copies to ALL matching folders
app.post('/api/reorganize', async (req, res) => {
  try {
    // Clear organized folder
    fs.emptyDirSync(organizedDir);
    
    // Clear person store
    ImageProcessor.clearPersonStore();
    
    // Clear all category collections
    await CollectionSync.clearAllCollections();
    
    // Get all images and reprocess
    const images = await Image.find().sort({ uploadDate: 1 });
    const results = [];

    for (const image of images) {
      // Re-generate embedding
      let embedding = image.embedding;
      if (!embedding || embedding.length === 0) {
        embedding = ImageProcessor.generateSimpleEmbedding(image.originalName);
      }

      // Re-analyze with new logic
      const autoTags = ImageProcessor.analyzeEmbedding(embedding, image.originalName);
      
      // Get ALL folder paths for this image
      const folderPaths = ImageProcessor.getAllFolderPaths(autoTags, image.tags);
      const organizedPaths = [];
      
      for (const folderPath of folderPaths) {
        const targetDir = path.join(organizedDir, folderPath);
        
        // Create directory and copy file
        fs.ensureDirSync(targetDir);
        const targetPath = path.join(targetDir, image.filename);
        
        if (fs.existsSync(image.filepath)) {
          fs.copyFileSync(image.filepath, targetPath);
        }
        organizedPaths.push(targetPath);
      }

      // Update image in database
      image.embedding = embedding;
      image.autoTags = autoTags;
      image.organized = true;
      image.organizedPath = organizedPaths[0];
      await image.save();

      // Sync to category collection
      await CollectionSync.addImageToCollection(image);

      results.push({
        id: image._id,
        filename: image.originalName,
        autoTags: autoTags,
        organizedTo: folderPaths // Return ALL folders
      });
    }

    res.json({
      message: `Reorganized ${results.length} image(s)`,
      trackedPersons: ImageProcessor.getTrackedPersons(),
      results: results
    });
  } catch (error) {
    console.error('Reorganize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error'
  });
});

// ========== CATEGORY COLLECTION ENDPOINTS ==========

// Get all category collections summary
app.get('/api/collections', async (req, res) => {
  try {
    const summary = await CollectionSync.getCollectionsSummary();
    res.json(summary);
  } catch (error) {
    console.error('Collections error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all persons
app.get('/api/collections/persons', async (req, res) => {
  try {
    const persons = await Person.find().populate('images', 'filename originalName uploadDate');
    res.json({
      count: persons.length,
      persons: persons.map(p => ({
        personId: p.personId,
        displayName: p.displayName,
        imageCount: p.metadata.imageCount,
        sampleImageUrl: p.sampleImageUrl,
        firstSeen: p.metadata.firstSeen,
        lastSeen: p.metadata.lastSeen,
        images: p.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`
        }))
      }))
    });
  } catch (error) {
    console.error('Persons error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pets collection
app.get('/api/collections/pets', async (req, res) => {
  try {
    const pets = await Pet.find().populate('images', 'filename originalName uploadDate');
    res.json({
      count: pets.length,
      pets: pets.map(p => ({
        category: p.category,
        imageCount: p.metadata.imageCount,
        sampleImageUrl: p.sampleImageUrl,
        images: p.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`
        }))
      }))
    });
  } catch (error) {
    console.error('Pets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get nature collection
app.get('/api/collections/nature', async (req, res) => {
  try {
    const nature = await Nature.find().populate('images', 'filename originalName uploadDate');
    res.json({
      count: nature.length,
      nature: nature.map(n => ({
        category: n.category,
        imageCount: n.metadata.imageCount,
        sampleImageUrl: n.sampleImageUrl,
        images: n.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`
        }))
      }))
    });
  } catch (error) {
    console.error('Nature error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vehicles collection
app.get('/api/collections/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find().populate('images', 'filename originalName uploadDate');
    res.json({
      count: vehicles.length,
      vehicles: vehicles.map(v => ({
        category: v.category,
        imageCount: v.metadata.imageCount,
        sampleImageUrl: v.sampleImageUrl,
        images: v.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`
        }))
      }))
    });
  } catch (error) {
    console.error('Vehicles error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`📂 Organized directory: ${organizedDir}`);
});
