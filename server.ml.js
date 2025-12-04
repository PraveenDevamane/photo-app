const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
require('dotenv').config();

// Models - No more Image model, using category collections directly
const Person = require('./models/Person');
const Pet = require('./models/Pet');
const Nature = require('./models/Nature');
const Vehicle = require('./models/Vehicle');

// Services
const ImageProcessor = require('./services/imageProcessor');
const CollectionSync = require('./services/collectionSync');
const MLImageTagger = require('./services/mlImageTagger');

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
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    // Initialize ML model on startup
    try {
      await MLImageTagger.initializeModel();
      console.log('✅ ML Model loaded');
    } catch (err) {
      console.log('⚠️ ML Model will load on first use');
    }
  })
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

// Upload image with ML-based tagging
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log(`📤 Processing upload: ${req.file.originalname}`);

    // Generate embedding for person matching
    let embedding = [];
    if (req.body.embedding) {
      try {
        embedding = JSON.parse(req.body.embedding);
      } catch (e) {
        console.log('Invalid embedding format');
      }
    }
    if (embedding.length === 0) {
      embedding = ImageProcessor.generateSimpleEmbedding(req.file.originalname);
    }

    // Parse custom tags
    let customTags = [];
    if (req.body.tags) {
      customTags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Use ML to analyze the image
    const mlAnalysis = await MLImageTagger.analyzeImage(req.file.path);
    console.log('🤖 ML Analysis:', mlAnalysis.categories.map(c => `${c.category} (${(c.confidence * 100).toFixed(1)}%)`));

    // Determine person ID if person detected
    let personId = null;
    const hasPersonCategory = mlAnalysis.categories.some(c => c.category === 'person');
    if (hasPersonCategory) {
      personId = ImageProcessor.findOrCreatePersonId(embedding);
    }

    // Prepare image data for storage
    const imageData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      embedding: embedding,
      tags: customTags,
      mlTags: mlAnalysis.mlTags,
      organized: false,
      organizedPaths: [],
      uploadedAt: new Date()
    };

    // Store image data in all detected category collections
    const syncResult = await CollectionSync.addImageToCollections(
      imageData, 
      mlAnalysis.categories,
      personId
    );

    res.status(201).json({
      message: 'Image uploaded and categorized successfully',
      image: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        categories: mlAnalysis.categories.map(c => c.category),
        mlTags: mlAnalysis.mlTags.slice(0, 5), // Top 5 ML tags
        personId: personId,
        addedTo: syncResult.addedTo
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all images from all collections
app.get('/api/images', async (req, res) => {
  try {
    const { category, organized } = req.query;
    
    let images = await CollectionSync.getAllImages();
    
    // Filter by category if specified
    if (category) {
      images = images.filter(img => img.categories.includes(category));
    }
    
    // Filter by organized status if specified
    if (organized !== undefined) {
      const isOrganized = organized === 'true';
      images = images.filter(img => img.organized === isOrganized);
    }

    // Sort by upload date (newest first)
    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      count: images.length,
      images: images.map(img => ({
        id: img._id,
        filename: img.filename,
        originalName: img.originalName,
        url: `/uploads/${img.filename}`,
        tags: img.tags,
        mlTags: img.mlTags,
        categories: img.categories,
        personId: img.personId,
        petType: img.petType,
        sceneType: img.sceneType,
        vehicleType: img.vehicleType,
        organized: img.organized,
        organizedPaths: img.organizedPaths,
        uploadedAt: img.uploadedAt
      }))
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single image by filename
app.get('/api/images/:filename', async (req, res) => {
  try {
    const image = await CollectionSync.findImageByFilename(req.params.filename);
    
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
      mlTags: image.mlTags,
      collection: image.collection,
      organized: image.organized,
      organizedPaths: image.organizedPaths,
      uploadedAt: image.uploadedAt
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update image category (manual tagging)
app.put('/api/images/:filename/category', async (req, res) => {
  try {
    const { category, subType } = req.body;
    const filename = req.params.filename;
    
    // Find the image data
    const existingImage = await CollectionSync.findImageByFilename(filename);
    
    if (!existingImage) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Prepare category info for adding to new collection
    const categoryInfo = { category };
    if (category === 'pet') categoryInfo.petType = subType || 'other';
    if (category === 'nature') categoryInfo.sceneType = subType || 'outdoor';
    if (category === 'vehicle') categoryInfo.vehicleType = subType || 'other';
    if (category === 'person') {
      const personId = ImageProcessor.findOrCreatePersonId(existingImage.embedding || []);
      await CollectionSync.addImageToCollections(existingImage, [categoryInfo], personId);
    } else {
      await CollectionSync.addImageToCollections(existingImage, [categoryInfo]);
    }

    res.json({
      message: `Image added to ${category} collection`,
      filename: filename,
      category: category
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete image from all collections
app.delete('/api/images/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Find and remove from collections
    const result = await CollectionSync.removeImageFromCollections(filename);
    
    if (!result.success) {
      return res.status(404).json({ error: 'Image not found or could not be deleted' });
    }

    // Delete file from filesystem
    const filepath = path.join(uploadsDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Organize images into folders - places in ALL category folders
app.post('/api/organize', async (req, res) => {
  try {
    const { filename } = req.body;
    
    let images;
    
    if (filename) {
      // Organize single image
      const image = await CollectionSync.findImageByFilename(filename);
      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      images = [image];
    } else {
      // Organize all unorganized images
      const allImages = await CollectionSync.getAllImages();
      images = allImages.filter(img => !img.organized);
    }

    const results = [];

    for (const image of images) {
      // Re-analyze with ML to get all categories
      const filepath = path.join(uploadsDir, image.filename);
      let categories = image.categories || [];
      
      // Generate folder paths based on categories
      const folderPaths = [];
      
      for (const category of categories) {
        let folderPath;
        
        switch (category) {
          case 'person':
            const personId = image.personId || 'unknown';
            folderPath = `people/${personId}`;
            break;
          case 'pet':
            const petType = image.petType || 'other';
            folderPath = `pets/${petType}`;
            break;
          case 'nature':
            const sceneType = image.sceneType || 'outdoor';
            folderPath = `nature/${sceneType}`;
            break;
          case 'vehicle':
            const vehicleType = image.vehicleType || 'other';
            folderPath = `vehicles/${vehicleType}`;
            break;
          default:
            folderPath = 'uncategorized';
        }
        
        folderPaths.push(folderPath);
      }

      // If no paths, put in uncategorized
      if (folderPaths.length === 0) {
        folderPaths.push('uncategorized');
      }

      // Copy to all folders
      const organizedPaths = [];
      for (const folderPath of folderPaths) {
        const targetDir = path.join(organizedDir, folderPath);
        fs.ensureDirSync(targetDir);
        
        const sourcePath = path.join(uploadsDir, image.filename);
        const targetPath = path.join(targetDir, image.filename);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          organizedPaths.push(targetPath);
        }
      }

      // Update organization status in all collections
      await CollectionSync.updateImageOrganizedStatus(image.filename, true, organizedPaths);

      results.push({
        filename: image.filename,
        organizedTo: folderPaths
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

// Reprocess all images with ML tagging
app.post('/api/reprocess', async (req, res) => {
  try {
    console.log('🔄 Starting ML reprocessing of all images...');
    
    // Get all image files from uploads directory
    const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    
    // Clear all collections
    await CollectionSync.clearAllCollections();
    ImageProcessor.clearPersonStore();
    
    const results = [];
    
    for (const filename of uploadedFiles) {
      const filepath = path.join(uploadsDir, filename);
      
      try {
        // Analyze with ML
        const mlAnalysis = await MLImageTagger.analyzeImage(filepath);
        console.log(`Processing ${filename}: ${mlAnalysis.categories.map(c => c.category).join(', ')}`);
        
        // Generate embedding
        const embedding = ImageProcessor.generateSimpleEmbedding(filename);
        
        // Get person ID if person detected
        let personId = null;
        if (mlAnalysis.categories.some(c => c.category === 'person')) {
          personId = ImageProcessor.findOrCreatePersonId(embedding);
        }
        
        // Prepare image data
        const imageData = {
          filename: filename,
          originalName: filename,
          filepath: filepath,
          mimetype: `image/${path.extname(filename).slice(1)}`,
          size: fs.statSync(filepath).size,
          embedding: embedding,
          tags: [],
          mlTags: mlAnalysis.mlTags,
          organized: false,
          organizedPaths: [],
          uploadedAt: new Date()
        };
        
        // Store in collections
        await CollectionSync.addImageToCollections(imageData, mlAnalysis.categories, personId);
        
        results.push({
          filename: filename,
          categories: mlAnalysis.categories.map(c => c.category),
          topMLTags: mlAnalysis.mlTags.slice(0, 3).map(t => t.label)
        });
      } catch (err) {
        console.error(`Error processing ${filename}:`, err.message);
        results.push({
          filename: filename,
          error: err.message
        });
      }
    }
    
    console.log(`✅ Reprocessed ${results.length} images`);
    
    res.json({
      message: `Re-processed ${results.length} image(s) with ML tagging`,
      results: results
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset and reorganize all images
app.post('/api/reorganize', async (req, res) => {
  try {
    console.log('🔄 Starting complete reorganization...');
    
    // Clear organized folder
    fs.emptyDirSync(organizedDir);
    
    // Clear collections and reprocess
    await CollectionSync.clearAllCollections();
    ImageProcessor.clearPersonStore();
    
    // Get all image files
    const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    
    const results = [];
    
    for (const filename of uploadedFiles) {
      const filepath = path.join(uploadsDir, filename);
      
      try {
        // Analyze with ML
        const mlAnalysis = await MLImageTagger.analyzeImage(filepath);
        
        // Generate embedding
        const embedding = ImageProcessor.generateSimpleEmbedding(filename);
        
        // Get person ID if needed
        let personId = null;
        if (mlAnalysis.categories.some(c => c.category === 'person')) {
          personId = ImageProcessor.findOrCreatePersonId(embedding);
        }
        
        // Generate folder paths
        const folderPaths = MLImageTagger.generateFolderPaths(mlAnalysis, personId);
        
        // Copy to organized folders
        const organizedPaths = [];
        for (const { path: folderPath } of folderPaths) {
          const targetDir = path.join(organizedDir, folderPath);
          fs.ensureDirSync(targetDir);
          
          const targetPath = path.join(targetDir, filename);
          fs.copyFileSync(filepath, targetPath);
          organizedPaths.push(targetPath);
        }
        
        // Prepare image data
        const imageData = {
          filename: filename,
          originalName: filename,
          filepath: filepath,
          mimetype: `image/${path.extname(filename).slice(1)}`,
          size: fs.statSync(filepath).size,
          embedding: embedding,
          tags: [],
          mlTags: mlAnalysis.mlTags,
          organized: true,
          organizedPaths: organizedPaths,
          uploadedAt: new Date()
        };
        
        // Store in collections
        await CollectionSync.addImageToCollections(imageData, mlAnalysis.categories, personId);
        
        results.push({
          filename: filename,
          categories: mlAnalysis.categories.map(c => c.category),
          organizedTo: folderPaths.map(f => f.path)
        });
      } catch (err) {
        console.error(`Error processing ${filename}:`, err.message);
        results.push({
          filename: filename,
          error: err.message
        });
      }
    }
    
    console.log(`✅ Reorganized ${results.length} images`);
    
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

// Get statistics from collections
app.get('/api/stats', async (req, res) => {
  try {
    const persons = await Person.find();
    const pets = await Pet.find();
    const nature = await Nature.find();
    const vehicles = await Vehicle.find();
    
    // Count unique images
    const allImages = await CollectionSync.getAllImages();
    const organized = allImages.filter(img => img.organized).length;
    
    // Sum up category counts
    const personCount = persons.reduce((sum, p) => sum + p.images.length, 0);
    const petCount = pets.reduce((sum, p) => sum + p.images.length, 0);
    const natureCount = nature.reduce((sum, n) => sum + n.images.length, 0);
    const vehicleCount = vehicles.reduce((sum, v) => sum + v.images.length, 0);

    res.json({
      total: allImages.length,
      organized: organized,
      unorganized: allImages.length - organized,
      categories: {
        people: personCount,
        pets: petCount,
        nature: natureCount,
        vehicles: vehicleCount
      },
      collections: {
        personGroups: persons.length,
        petTypes: pets.length,
        natureScenes: nature.length,
        vehicleTypes: vehicles.length
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
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
    const persons = await Person.find();
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
          url: `/uploads/${img.filename}`,
          mlTags: img.mlTags,
          organized: img.organized
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
    const pets = await Pet.find();
    res.json({
      count: pets.length,
      pets: pets.map(p => ({
        category: p.category,
        petType: p.petType,
        imageCount: p.metadata.imageCount,
        sampleImageUrl: p.sampleImageUrl,
        images: p.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`,
          petType: img.petType,
          mlTags: img.mlTags,
          organized: img.organized
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
    const nature = await Nature.find();
    res.json({
      count: nature.length,
      nature: nature.map(n => ({
        category: n.category,
        sceneType: n.sceneType,
        imageCount: n.metadata.imageCount,
        sampleImageUrl: n.sampleImageUrl,
        images: n.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`,
          sceneType: img.sceneType,
          mlTags: img.mlTags,
          organized: img.organized
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
    const vehicles = await Vehicle.find();
    res.json({
      count: vehicles.length,
      vehicles: vehicles.map(v => ({
        category: v.category,
        vehicleType: v.vehicleType,
        imageCount: v.metadata.imageCount,
        sampleImageUrl: v.sampleImageUrl,
        images: v.images.map(img => ({
          id: img._id,
          filename: img.filename,
          originalName: img.originalName,
          url: `/uploads/${img.filename}`,
          vehicleType: img.vehicleType,
          mlTags: img.mlTags,
          organized: img.organized
        }))
      }))
    });
  } catch (error) {
    console.error('Vehicles error:', error);
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`📂 Organized directory: ${organizedDir}`);
  console.log(`🤖 ML tagging enabled with MobileNet`);
});
