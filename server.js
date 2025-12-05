const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
require('dotenv').config();

// Models - Category collections that store full image data
const Person = require('./models/Person');
const Pet = require('./models/Pet');
const Nature = require('./models/Nature');
const Vehicle = require('./models/Vehicle');

// Model with Assertions & Triggers for demonstration
const ImageWithValidation = require('./models/ImageWithValidation');

// Services
const ImageProcessor = require('./services/imageProcessor');
const CollectionSync = require('./services/collectionSync');

// CLIP-based Image Tagger (Primary method)
const clipTagger = require('./services/clipTagger');

// Flag to track if CLIP is available
let clipModelAvailable = false;

// Initialize CLIP model on startup
(async () => {
  try {
    clipModelAvailable = await clipTagger.initialize();
    if (clipModelAvailable) {
      console.log('🎯 CLIP-based image classification enabled');
    } else {
      console.log('⚠️  CLIP not available, using filename-based classification');
    }
  } catch (error) {
    console.log('⚠️  CLIP initialization failed:', error.message);
    console.log('   Falling back to filename-based classification');
  }
})();

console.log('ℹ️  Image Auto-Tagging Agent initialized');
console.log('   Primary: CLIP embeddings (if available)');
console.log('   Secondary: Filename-based tagging');

// Helper function to convert autoTags object to array for display
function autoTagsToArray(autoTags) {
  if (Array.isArray(autoTags)) return autoTags;
  if (!autoTags || typeof autoTags !== 'object') return [];
  
  const tags = [];
  if (autoTags.vehicle) tags.push('vehicle');
  if (autoTags.pets) tags.push('pet');
  if (autoTags.nature) tags.push('nature');
  if (autoTags.person_id) tags.push('person');
  if (autoTags.objects && Array.isArray(autoTags.objects)) {
    autoTags.objects.forEach(obj => {
      if (!tags.includes(obj)) tags.push(obj);
    });
  }
  return tags.length > 0 ? tags : ['uncategorized'];
}

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
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    // Preserve original filename for better classification, add timestamp to prevent duplicates
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ========== ROUTES ==========

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload image - stores directly in category collections
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log(`📤 Processing: ${req.file.originalname}`);

    // Generate embedding
    let embedding = [];
    if (req.body.embedding) {
      try { embedding = JSON.parse(req.body.embedding); } catch (e) {}
    }
    if (embedding.length === 0) {
      embedding = ImageProcessor.generateSimpleEmbedding(req.file.originalname);
    }

    // Parse custom tags
    let customTags = [];
    if (req.body.tags) {
      customTags = req.body.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);
    }

    // PRIORITY: Custom tags override auto-detection
    // Check if user provided category tags
    let autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: []
    };
    
    const categoryTags = ['person', 'pet', 'nature', 'vehicle', 'dog', 'cat', 'car', 'bike', 'flower', 'tree', 'family', 'portrait'];
    const userCategory = customTags.find(tag => categoryTags.some(ct => tag.includes(ct)));
    
    if (userCategory) {
      // User specified a category - use it!
      console.log(`  👤 User specified category: "${userCategory}"`);
      if (userCategory.includes('person') || userCategory.includes('family') || userCategory.includes('portrait') || userCategory.includes('selfie')) {
        autoTags.person_id = ImageProcessor.findOrCreatePersonId(embedding, req.file.originalname);
        autoTags.objects.push('portrait');
      }
      if (userCategory.includes('pet') || userCategory.includes('dog') || userCategory.includes('cat') || userCategory.includes('animal')) {
        autoTags.pets = true;
        autoTags.objects.push('animal');
      }
      if (userCategory.includes('nature') || userCategory.includes('flower') || userCategory.includes('tree') || userCategory.includes('landscape') || userCategory.includes('sunset') || userCategory.includes('beach')) {
        autoTags.nature = true;
        autoTags.objects.push('outdoor');
      }
      if (userCategory.includes('vehicle') || userCategory.includes('car') || userCategory.includes('bike') || userCategory.includes('truck')) {
        autoTags.vehicle = true;
        autoTags.objects.push('vehicle');
      }
    } else {
      // No user category - use auto-detection
      // PRIMARY: Try CLIP-based tagging first
      if (clipModelAvailable) {
        try {
          console.log('🎯 Using CLIP for image analysis...');
          const clipResult = await clipTagger.analyzeImage(req.file.path, req.file.originalname);
          autoTags = clipResult.autoTags;
          
          // Add CLIP tags to custom tags for display
          if (clipResult.combinedTags && clipResult.combinedTags.length > 0) {
            customTags = [...new Set([...customTags, ...clipResult.combinedTags])];
          }
          
          console.log(`  ✅ CLIP analysis complete (method: ${clipResult.method})`);
        } catch (clipError) {
          console.log('  ⚠️ CLIP failed, falling back to filename analysis');
          autoTags = ImageProcessor.analyzeEmbedding(embedding, req.file.originalname);
        }
      } else {
        // SECONDARY: Fall back to filename-based tagging
        autoTags = ImageProcessor.analyzeEmbedding(embedding, req.file.originalname);
      }
    }

    // Create full image data object
    const imageData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      embedding: embedding,
      tags: customTags,
      autoTags: autoTags,
      organized: false,
      organizedPaths: [],
      uploadedAt: new Date()
    };

    // Store FULL image data in category collections (not just ObjectId)
    const syncResult = await CollectionSync.addImageToCollections(imageData);

    res.status(201).json({
      message: 'Image uploaded and stored in category collections',
      image: {
        filename: imageData.filename,
        originalName: imageData.originalName,
        tags: imageData.tags,
        autoTags: autoTagsToArray(imageData.autoTags),
        addedTo: syncResult.addedTo,
        uploadedAt: imageData.uploadedAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all images from category collections
app.get('/api/images', async (req, res) => {
  try {
    const { category, organized } = req.query;
    
    let images = await CollectionSync.getAllImages();
    
    // Filter by category
    if (category) {
      images = images.filter(img => img.categories && img.categories.includes(category));
    }
    
    // Filter by organized status
    if (organized !== undefined) {
      const isOrganized = organized === 'true';
      images = images.filter(img => img.organized === isOrganized);
    }

    // Sort by upload date
    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      count: images.length,
      images: images.map(img => ({
        id: img._id,
        filename: img.filename,
        originalName: img.originalName,
        url: `/uploads/${img.filename}`,
        tags: img.tags,
        autoTags: autoTagsToArray(img.autoTags),
        categories: img.categories,
        personId: img.personId,
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
      autoTags: autoTagsToArray(image.autoTags),
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

// Delete image
app.delete('/api/images/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Remove from all collections
    await CollectionSync.removeImageFromCollections(filename);

    // Delete file
    const filepath = path.join(uploadsDir, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update image tags - TRIGGERS re-classification and moves to new collection(s)
app.put('/api/images/:filename/tags', async (req, res) => {
  try {
    const filename = req.params.filename;
    const { tags } = req.body; // New custom tags from user
    
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array of strings' });
    }
    
    console.log(`🔄 Updating tags for: ${filename}`);
    console.log(`   New tags: ${tags.join(', ')}`);
    
    // 1. Find existing image data
    const existingImage = await CollectionSync.findImageByFilename(filename);
    if (!existingImage) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // 2. Remove from ALL current collections (TRIGGER: pre-update cleanup)
    console.log('   📤 Removing from current collections...');
    await CollectionSync.removeImageFromCollections(filename);
    
    // 3. Re-classify based on NEW tags (TRIGGER: re-classification)
    const customTags = tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag);
    
    // Generate new autoTags based on custom tags AND filename
    let autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: []
    };
    
    // Check custom tags for category keywords
    const categoryKeywords = {
      person: ['person', 'people', 'family', 'portrait', 'selfie', 'face', 'man', 'woman', 'child', 'kid', 'baby'],
      pet: ['pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'bird', 'fish', 'rabbit', 'hamster'],
      nature: ['nature', 'landscape', 'flower', 'tree', 'beach', 'mountain', 'sunset', 'sunrise', 'forest', 'ocean', 'sky', 'garden', 'park'],
      vehicle: ['vehicle', 'car', 'bike', 'truck', 'motorcycle', 'bus', 'train', 'plane', 'boat', 'ship']
    };
    
    // Analyze custom tags for categories
    for (const tag of customTags) {
      if (categoryKeywords.person.some(k => tag.includes(k))) {
        autoTags.person_id = existingImage.autoTags?.person_id || ImageProcessor.findOrCreatePersonId(existingImage.embedding || [], filename);
        autoTags.objects.push('portrait');
      }
      if (categoryKeywords.pet.some(k => tag.includes(k))) {
        autoTags.pets = true;
        autoTags.objects.push('animal');
      }
      if (categoryKeywords.nature.some(k => tag.includes(k))) {
        autoTags.nature = true;
        autoTags.objects.push('outdoor');
      }
      if (categoryKeywords.vehicle.some(k => tag.includes(k))) {
        autoTags.vehicle = true;
        autoTags.objects.push('vehicle');
      }
    }
    
    // If no category detected from custom tags, fall back to filename analysis
    if (!autoTags.person_id && !autoTags.pets && !autoTags.nature && !autoTags.vehicle) {
      console.log('   🔍 No category in tags, analyzing filename...');
      autoTags = ImageProcessor.analyzeFilename(existingImage.originalName || filename, existingImage.embedding || []);
    }
    
    // 4. Prepare updated image data
    const updatedImageData = {
      filename: existingImage.filename,
      originalName: existingImage.originalName,
      filepath: existingImage.filepath,
      mimetype: existingImage.mimetype,
      size: existingImage.size,
      embedding: existingImage.embedding || [],
      tags: customTags, // NEW custom tags
      autoTags: autoTags, // NEW auto-classification
      organized: false, // Reset organized status
      organizedPaths: [],
      uploadedAt: existingImage.uploadedAt || new Date()
    };
    
    // 5. Add to NEW collection(s) based on updated classification (TRIGGER: post-update insert)
    console.log('   📥 Adding to new collection(s)...');
    const results = await CollectionSync.addImageToCollections(updatedImageData);
    
    console.log(`   ✅ Moved to: ${results.addedTo.join(', ')}`);
    
    res.json({
      message: 'Tags updated and image re-classified successfully',
      filename: filename,
      oldCollection: existingImage.collection,
      newCollections: results.addedTo,
      tags: customTags,
      autoTags: autoTagsToArray(autoTags)
    });
    
  } catch (error) {
    console.error('Update tags error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Organize images
app.post('/api/organize', async (req, res) => {
  try {
    const { filename } = req.body;
    
    let images;
    if (filename) {
      const image = await CollectionSync.findImageByFilename(filename);
      if (!image) return res.status(404).json({ error: 'Image not found' });
      images = [image];
    } else {
      const allImages = await CollectionSync.getAllImages();
      images = allImages.filter(img => !img.organized);
    }

    const results = [];

    for (const image of images) {
      const folderPaths = ImageProcessor.getAllFolderPaths(image.autoTags, image.tags);
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

      await CollectionSync.updateImageOrganizedStatus(image.filename, true, organizedPaths);

      results.push({
        filename: image.filename,
        organizedTo: folderPaths
      });
    }

    res.json({
      message: `Successfully organized ${results.length} image(s)`,
      results
    });
  } catch (error) {
    console.error('Organize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reprocess all images
app.post('/api/reprocess', async (req, res) => {
  try {
    console.log('🔄 Reprocessing all images...');
    
    const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    
    await CollectionSync.clearAllCollections();
    ImageProcessor.clearPersonStore();
    
    const results = [];
    
    for (const filename of uploadedFiles) {
      const filepath = path.join(uploadsDir, filename);
      const embedding = ImageProcessor.generateSimpleEmbedding(filename);
      
      // Try CLIP-based classification first
      let autoTags;
      if (clipModelAvailable) {
        try {
          console.log(`  🎯 CLIP classifying: ${filename}`);
          const clipResult = await clipTagger.analyzeImage(filepath, filename);
          autoTags = clipResult.autoTags;
          console.log(`  ✅ CLIP detected: ${autoTagsToArray(autoTags).join(', ')}`);
        } catch (clipError) {
          console.log(`  ⚠️ CLIP failed for ${filename}, using fallback`);
          autoTags = ImageProcessor.analyzeEmbedding(embedding, filename);
        }
      } else {
        autoTags = ImageProcessor.analyzeEmbedding(embedding, filename);
      }
      
      const imageData = {
        filename,
        originalName: filename,
        filepath,
        mimetype: `image/${path.extname(filename).slice(1)}`,
        size: fs.statSync(filepath).size,
        embedding,
        tags: [],
        autoTags,
        organized: false,
        organizedPaths: [],
        uploadedAt: new Date()
      };
      
      await CollectionSync.addImageToCollections(imageData);
      
      results.push({
        filename,
        autoTags: autoTagsToArray(autoTags)
      });
    }
    
    res.json({
      message: `Re-processed ${results.length} image(s)${clipModelAvailable ? ' with CLIP' : ''}`,
      clipEnabled: clipModelAvailable,
      results
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorganize all images
app.post('/api/reorganize', async (req, res) => {
  try {
    console.log('🔄 Reorganizing all images...');
    
    fs.emptyDirSync(organizedDir);
    await CollectionSync.clearAllCollections();
    ImageProcessor.clearPersonStore();
    
    const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    
    const results = [];
    
    for (const filename of uploadedFiles) {
      const filepath = path.join(uploadsDir, filename);
      const embedding = ImageProcessor.generateSimpleEmbedding(filename);
      
      // Try CLIP-based classification first
      let autoTags;
      if (clipModelAvailable) {
        try {
          console.log(`  🎯 CLIP classifying: ${filename}`);
          const clipResult = await clipTagger.analyzeImage(filepath, filename);
          autoTags = clipResult.autoTags;
          console.log(`  ✅ CLIP detected: ${autoTagsToArray(autoTags).join(', ')}`);
        } catch (clipError) {
          console.log(`  ⚠️ CLIP failed for ${filename}, using fallback`);
          autoTags = ImageProcessor.analyzeEmbedding(embedding, filename);
        }
      } else {
        autoTags = ImageProcessor.analyzeEmbedding(embedding, filename);
      }
      
      const folderPaths = ImageProcessor.getAllFolderPaths(autoTags, []);
      const organizedPaths = [];
      
      for (const folderPath of folderPaths) {
        const targetDir = path.join(organizedDir, folderPath);
        fs.ensureDirSync(targetDir);
        const targetPath = path.join(targetDir, filename);
        fs.copyFileSync(filepath, targetPath);
        organizedPaths.push(targetPath);
      }
      
      const imageData = {
        filename,
        originalName: filename,
        filepath,
        mimetype: `image/${path.extname(filename).slice(1)}`,
        size: fs.statSync(filepath).size,
        embedding,
        tags: [],
        autoTags,
        organized: true,
        organizedPaths,
        uploadedAt: new Date()
      };
      
      await CollectionSync.addImageToCollections(imageData);
      
      results.push({
        filename,
        autoTags: autoTagsToArray(autoTags),
        organizedTo: folderPaths
      });
    }
    
    res.json({
      message: `Reorganized ${results.length} image(s)${clipModelAvailable ? ' with CLIP' : ''}`,
      clipEnabled: clipModelAvailable,
      trackedPersons: ImageProcessor.getTrackedPersons(),
      results
    });
  } catch (error) {
    console.error('Reorganize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search photos by tags - Optimized MongoDB query
app.get('/api/search', async (req, res) => {
  try {
    const { q, tags } = req.query;
    const searchTerms = q ? q.toLowerCase().split(',').map(t => t.trim()).filter(t => t) 
                         : (tags ? tags.toLowerCase().split(',').map(t => t.trim()).filter(t => t) : []);
    
    if (searchTerms.length === 0) {
      return res.status(400).json({ error: 'Please provide search terms using ?q= or ?tags= parameter' });
    }
    
    console.log(`🔍 Searching MongoDB for tags: ${searchTerms.join(', ')}`);
    
    // Use optimized MongoDB search instead of fetching all images
    const matchedImages = await CollectionSync.searchImagesByTags(searchTerms);
    
    // Format the results
    const results = matchedImages.map(image => ({
      filename: image.filename,
      originalName: image.originalName,
      url: '/uploads/' + image.filename,
      tags: Array.isArray(image.tags) ? image.tags : [],
      autoTags: autoTagsToArray(image.autoTags || {}),
      categories: image.categories || [],
      organized: image.organized,
      personId: image.personId
    }));
    
    console.log(`✅ Found ${results.length} matching image(s) in MongoDB`);
    
    res.json({
      query: searchTerms,
      count: results.length,
      images: results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get CLIP tagger status
app.get('/api/clip/status', async (req, res) => {
  try {
    const status = clipTagger.getStatus();
    res.json({
      ...status,
      available: clipModelAvailable,
      message: clipModelAvailable 
        ? 'CLIP model is active - using AI-powered image tagging'
        : 'CLIP not available - using filename-based tagging'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze image with CLIP (manual trigger)
app.post('/api/clip/analyze/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    if (!clipModelAvailable) {
      return res.status(503).json({ 
        error: 'CLIP model not available',
        fallback: 'Using filename-based tagging instead'
      });
    }
    
    const result = await clipTagger.analyzeImage(imagePath, filename);
    
    res.json({
      filename,
      analysis: result,
      message: `Analyzed using ${result.method} method`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const persons = await Person.find();
    const pets = await Pet.find();
    const nature = await Nature.find();
    const vehicles = await Vehicle.find();
    
    const allImages = await CollectionSync.getAllImages();
    const organized = allImages.filter(img => img.organized).length;
    
    const personCount = persons.reduce((sum, p) => sum + p.images.length, 0);
    const petCount = pets.reduce((sum, p) => sum + p.images.length, 0);
    const natureCount = nature.reduce((sum, n) => sum + n.images.length, 0);
    const vehicleCount = vehicles.reduce((sum, v) => sum + v.images.length, 0);

    res.json({
      total: allImages.length,
      organized,
      unorganized: allImages.length - organized,
      categories: {
        people: personCount,
        pets: petCount,
        nature: natureCount,
        vehicles: vehicleCount
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collections summary
app.get('/api/collections', async (req, res) => {
  try {
    const summary = await CollectionSync.getCollectionsSummary();
    res.json(summary);
  } catch (error) {
    console.error('Collections error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific collections
app.get('/api/collections/persons', async (req, res) => {
  try {
    const persons = await Person.find();
    res.json({ count: persons.length, persons });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/collections/pets', async (req, res) => {
  try {
    const pets = await Pet.find();
    res.json({ count: pets.length, pets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/collections/nature', async (req, res) => {
  try {
    const nature = await Nature.find();
    res.json({ count: nature.length, nature });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/collections/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find();
    res.json({ count: vehicles.length, vehicles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ASSERTIONS & TRIGGERS DEMO ENDPOINTS
// ============================================

// Demo: Test Assertions (Schema Validation)
app.post('/api/demo/assertions', async (req, res) => {
  console.log('\n========================================');
  console.log('  ASSERTIONS DEMO (Schema Validation)');
  console.log('========================================\n');
  
  const results = [];
  
  const testCases = [
    {
      name: '✅ Valid Image Data',
      data: {
        filename: 'valid_image.jpg',
        originalName: 'My Valid Image.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        tags: ['nature', 'landscape']
      },
      shouldPass: true
    },
    {
      name: '❌ Missing Required Field (filename)',
      data: {
        originalName: 'No filename.jpg',
        mimetype: 'image/jpeg'
      },
      shouldPass: false
    },
    {
      name: '❌ Invalid Mimetype (text/plain)',
      data: {
        filename: 'document.txt',
        originalName: 'document.txt',
        mimetype: 'text/plain'
      },
      shouldPass: false
    },
    {
      name: '❌ File Too Large (100MB)',
      data: {
        filename: 'huge_file.jpg',
        originalName: 'huge_file.jpg',
        mimetype: 'image/jpeg',
        size: 100 * 1024 * 1024
      },
      shouldPass: false
    }
  ];
  
  for (const test of testCases) {
    console.log(`\n📋 Testing: ${test.name}`);
    try {
      const doc = new ImageWithValidation(test.data);
      await doc.validate();
      results.push({
        test: test.name,
        expected: test.shouldPass ? 'PASS' : 'FAIL',
        actual: 'PASS',
        success: test.shouldPass === true,
        message: 'Validation passed'
      });
      console.log(`   ✅ Validation passed`);
    } catch (error) {
      results.push({
        test: test.name,
        expected: test.shouldPass ? 'PASS' : 'FAIL',
        actual: 'FAIL',
        success: test.shouldPass === false,
        message: error.message
      });
      console.log(`   ❌ Validation failed: ${error.message}`);
    }
  }
  
  res.json({
    demo: 'Assertions (Schema Validation)',
    description: 'Assertions validate data BEFORE it is saved to the database',
    totalTests: results.length,
    passed: results.filter(r => r.success).length,
    results
  });
});

// Demo: Test Triggers (Mongoose Middleware)
app.post('/api/demo/triggers', async (req, res) => {
  console.log('\n========================================');
  console.log('  TRIGGERS DEMO (Mongoose Middleware)');
  console.log('========================================\n');
  
  const events = [];
  
  try {
    // Step 1: CREATE - Triggers: pre-save, post-save
    console.log('\n📌 STEP 1: CREATE (Testing pre-save, post-save triggers)');
    events.push({ step: 1, operation: 'CREATE', triggers: ['pre-save', 'post-save'] });
    
    const newDoc = new ImageWithValidation({
      filename: `trigger_demo_${Date.now()}.jpg`,
      originalName: 'Trigger Demo Image.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
      tags: ['demo', 'trigger']
    });
    const savedDoc = await newDoc.save();
    events.push({ 
      step: 1, 
      result: 'Document created', 
      docId: savedDoc._id,
      filename: savedDoc.filename,
      autoGeneratedUrl: savedDoc.imageUrl,
      version: savedDoc.version
    });
    
    // Step 2: FIND - Triggers: pre-find, post-find
    console.log('\n📌 STEP 2: FIND (Testing pre-find, post-find triggers)');
    events.push({ step: 2, operation: 'FIND', triggers: ['pre-find', 'post-find'] });
    
    const foundDocs = await ImageWithValidation.find({ _id: savedDoc._id });
    events.push({ 
      step: 2, 
      result: 'Document found', 
      count: foundDocs.length 
    });
    
    // Step 3: UPDATE - Triggers: pre-update, post-update
    console.log('\n📌 STEP 3: UPDATE (Testing pre-update, post-update triggers)');
    events.push({ step: 3, operation: 'UPDATE', triggers: ['pre-update', 'post-update'] });
    
    const updatedDoc = await ImageWithValidation.findOneAndUpdate(
      { _id: savedDoc._id },
      { $set: { tags: ['updated', 'demo'] } },
      { new: true }
    );
    events.push({ 
      step: 3, 
      result: 'Document updated', 
      newTags: updatedDoc.tags,
      newVersion: updatedDoc.version
    });
    
    // Step 4: DELETE - Triggers: pre-delete, post-delete
    console.log('\n📌 STEP 4: DELETE (Testing pre-delete, post-delete triggers)');
    events.push({ step: 4, operation: 'DELETE', triggers: ['pre-delete', 'post-delete'] });
    
    const deletedDoc = await ImageWithValidation.findOneAndDelete({ _id: savedDoc._id });
    events.push({ 
      step: 4, 
      result: 'Document deleted', 
      deletedFilename: deletedDoc.filename 
    });
    
    res.json({
      demo: 'Triggers (Mongoose Middleware)',
      description: 'Triggers are functions that run automatically on database operations',
      message: 'Check the server console to see trigger logs!',
      triggerTypes: {
        'pre-save': 'Runs BEFORE saving a document',
        'post-save': 'Runs AFTER saving a document',
        'pre-find': 'Runs BEFORE executing a query',
        'post-find': 'Runs AFTER executing a query',
        'pre-update': 'Runs BEFORE updating a document',
        'post-update': 'Runs AFTER updating a document',
        'pre-delete': 'Runs BEFORE deleting a document',
        'post-delete': 'Runs AFTER deleting a document'
      },
      events
    });
    
  } catch (error) {
    res.status(500).json({ 
      demo: 'Triggers', 
      error: error.message,
      events 
    });
  }
});

// Demo: Combined Info
app.get('/api/demo/info', (req, res) => {
  res.json({
    title: 'MongoDB Assertions & Triggers Demo',
    endpoints: {
      '/api/demo/assertions': {
        method: 'POST',
        description: 'Test schema validation (assertions) with various test cases'
      },
      '/api/demo/triggers': {
        method: 'POST',
        description: 'Demonstrate pre/post hooks (triggers) for CRUD operations'
      }
    },
    concepts: {
      assertions: {
        definition: 'Schema validation rules that ensure data integrity',
        examples: [
          'Required fields (filename must exist)',
          'Enum validation (mimetype must be image/jpeg, image/png, etc.)',
          'Min/Max values (file size limits)',
          'Custom validators (tag length restrictions)',
          'Regex patterns (URL format validation)'
        ],
        whenRuns: 'BEFORE data is inserted or updated'
      },
      triggers: {
        definition: 'Automated functions that execute on database events',
        types: [
          'pre-save: Run before saving',
          'post-save: Run after saving',
          'pre-find: Run before queries',
          'post-find: Run after queries',
          'pre-update: Run before updates',
          'post-update: Run after updates',
          'pre-delete: Run before deletions',
          'post-delete: Run after deletions'
        ],
        useCases: [
          'Auto-update timestamps',
          'Version incrementing',
          'Logging and auditing',
          'Cascading updates/deletes',
          'Data transformation',
          'Sending notifications'
        ]
      }
    }
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`📂 Organized directory: ${organizedDir}`);
  console.log(`💾 Storing FULL image data in category collections (no Images collection)`);
  console.log(`🧪 Demo endpoints available: /api/demo/info, /api/demo/assertions, /api/demo/triggers`);
});

