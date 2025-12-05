/**
 * ============================================
 * CLIP-BASED IMAGE AUTO-TAGGING AGENT
 * ============================================
 * 
 * Primary: Uses CLIP embeddings to analyze images and generate tags
 * Secondary: Falls back to filename-based tags only when useful
 * 
 * CLIP (Contrastive Language-Image Pre-Training) creates embeddings
 * that can be compared between images and text using cosine similarity.
 */

const path = require('path');
const fs = require('fs');

// Predefined tag categories for CLIP comparison
const TAG_CATEGORIES = {
  // Objects
  objects: [
    'person', 'people', 'face', 'portrait', 'selfie', 'group photo',
    'dog', 'cat', 'bird', 'animal', 'pet', 'puppy', 'kitten',
    'car', 'vehicle', 'motorcycle', 'bicycle', 'truck', 'bus',
    'building', 'house', 'architecture', 'skyscraper', 'bridge',
    'food', 'meal', 'drink', 'fruit', 'vegetables', 'dessert',
    'phone', 'laptop', 'computer', 'electronics', 'camera',
    'furniture', 'chair', 'table', 'bed', 'sofa',
    'clothing', 'dress', 'shirt', 'shoes', 'accessories',
    'plant', 'flower', 'tree', 'garden', 'grass'
  ],
  
  // Scenes/Locations
  scenes: [
    'indoor', 'outdoor', 'nature', 'urban', 'rural',
    'beach', 'ocean', 'sea', 'lake', 'river', 'waterfall',
    'mountain', 'forest', 'desert', 'field', 'meadow',
    'city', 'street', 'road', 'park', 'playground',
    'restaurant', 'cafe', 'office', 'home', 'bedroom', 'kitchen',
    'gym', 'stadium', 'concert', 'party', 'wedding',
    'airport', 'train station', 'hotel', 'museum', 'church'
  ],
  
  // Sky/Weather
  weather: [
    'sunny', 'cloudy', 'rainy', 'snowy', 'foggy',
    'sunset', 'sunrise', 'night', 'daytime', 'golden hour',
    'sky', 'clouds', 'rainbow', 'stars', 'moon'
  ],
  
  // Actions/Activities
  actions: [
    'walking', 'running', 'sitting', 'standing', 'jumping',
    'eating', 'drinking', 'cooking', 'reading', 'writing',
    'playing', 'working', 'sleeping', 'dancing', 'singing',
    'swimming', 'hiking', 'cycling', 'driving', 'traveling',
    'celebrating', 'smiling', 'laughing', 'posing'
  ],
  
  // Emotions/Mood
  emotions: [
    'happy', 'joyful', 'peaceful', 'romantic', 'exciting',
    'calm', 'serene', 'dramatic', 'mysterious', 'nostalgic'
  ],
  
  // Colors (dominant)
  colors: [
    'colorful', 'vibrant', 'bright', 'dark', 'pastel',
    'black and white', 'monochrome', 'warm tones', 'cool tones'
  ],
  
  // Style
  style: [
    'professional', 'casual', 'artistic', 'vintage', 'modern',
    'minimalist', 'detailed', 'close-up', 'wide shot', 'aerial view'
  ]
};

// Flatten all tags for comparison
const ALL_TAGS = Object.values(TAG_CATEGORIES).flat();

/**
 * CLIP Tagger Agent Class
 * Implements the Image Auto-Tagging Agent specification
 */
class CLIPTagger {
  constructor() {
    this.pipeline = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the CLIP model
   * Uses @xenova/transformers for browser/Node.js compatibility
   */
  async initialize() {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('🔄 Initializing CLIP model...');
        
        // Dynamic import for @xenova/transformers
        const { pipeline, env } = await import('@xenova/transformers');
        
        // Configure for Node.js environment
        env.allowLocalModels = false;
        env.useBrowserCache = false;
        
        // Load zero-shot image classification pipeline (CLIP-based)
        this.pipeline = await pipeline(
          'zero-shot-image-classification',
          'Xenova/clip-vit-base-patch32'
        );
        
        this.isInitialized = true;
        console.log('✅ CLIP model initialized successfully');
        return true;
      } catch (error) {
        console.error('❌ Failed to initialize CLIP model:', error.message);
        console.log('⚠️  Falling back to filename-based tagging only');
        this.isInitialized = false;
        return false;
      }
    })();

    return this.initPromise;
  }

  /**
   * PRIMARY TASK: Generate tags using CLIP embeddings
   * @param {string} imagePath - Path to the image file
   * @returns {Array} Top 5 tags with similarity scores
   */
  async generateCLIPTags(imagePath) {
    if (!this.isInitialized || !this.pipeline) {
      return null;
    }

    try {
      console.log(`🖼️  Analyzing image with CLIP: ${path.basename(imagePath)}`);
      
      // Run zero-shot classification with all candidate tags
      const results = await this.pipeline(imagePath, ALL_TAGS);
      
      // Sort by score and get top 5
      const topTags = results
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => ({
          tag: r.label,
          score: Math.round(r.score * 100) / 100,
          confidence: r.score > 0.3 ? 'high' : r.score > 0.15 ? 'medium' : 'low'
        }));
      
      console.log('📊 CLIP Tags:', topTags.map(t => `${t.tag}(${t.score})`).join(', '));
      
      return topTags;
    } catch (error) {
      console.error('❌ CLIP analysis failed:', error.message);
      return null;
    }
  }

  /**
   * SECONDARY TASK: Extract tags from filename (only if useful)
   * @param {string} filename - Original filename
   * @returns {Array} Extracted tags from filename
   */
  extractFilenameTags(filename) {
    // Remove extension
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    
    // Check if filename is meaningless (like IMG_00217, DSC_1234)
    const meaninglessPatterns = [
      /^IMG[-_]?\d+$/i,
      /^DSC[-_]?\d+$/i,
      /^DCIM[-_]?\d+$/i,
      /^Photo[-_]?\d+$/i,
      /^Screenshot[-_]?\d+$/i,
      /^\d{10,}$/,  // Just timestamps
      /^[a-f0-9]{8,}$/i,  // Hash-like names
      /^\d+-[a-z0-9_]+$/i  // Timestamp prefix (our format)
    ];
    
    const isMeaningless = meaninglessPatterns.some(pattern => pattern.test(nameWithoutExt));
    
    if (isMeaningless) {
      console.log('📝 Filename not useful for tagging:', filename);
      return [];
    }
    
    // Extract meaningful words from filename
    const words = nameWithoutExt
      .toLowerCase()
      .replace(/[0-9]+/g, ' ')  // Remove numbers
      .replace(/[-_\.]/g, ' ')   // Replace separators with space
      .split(/\s+/)
      .filter(word => word.length > 2)  // Min 3 characters
      .filter(word => !['the', 'and', 'for', 'with', 'from'].includes(word));  // Remove stop words
    
    // Match with known tags
    const matchedTags = words.filter(word => 
      ALL_TAGS.some(tag => 
        tag.toLowerCase().includes(word) || word.includes(tag.toLowerCase())
      )
    );
    
    // Also include original words that seem meaningful
    const meaningfulWords = words.filter(word => word.length >= 4);
    
    const uniqueTags = [...new Set([...matchedTags, ...meaningfulWords])].slice(0, 3);
    
    if (uniqueTags.length > 0) {
      console.log('📝 Filename tags:', uniqueTags.join(', '));
    }
    
    return uniqueTags;
  }

  /**
   * MAIN METHOD: Analyze image and generate all tags
   * Combines CLIP-based tags with filename-based tags
   * @param {string} imagePath - Path to image file
   * @param {string} originalFilename - Original filename
   * @returns {Object} Complete tagging result
   */
  async analyzeImage(imagePath, originalFilename) {
    const result = {
      clipTags: [],
      filenameTags: [],
      combinedTags: [],
      primaryCategory: null,
      autoTags: {
        person_id: null,
        nature: false,
        pets: false,
        vehicle: false,
        objects: []
      },
      confidence: 'low',
      method: 'filename'  // Default fallback
    };

    // 1. Try CLIP-based tagging first (Primary Task)
    await this.initialize();
    
    if (this.isInitialized) {
      const clipTags = await this.generateCLIPTags(imagePath);
      
      if (clipTags && clipTags.length > 0) {
        result.clipTags = clipTags;
        result.method = 'clip';
        result.confidence = clipTags[0].confidence;
        
        // Extract tag names
        const tagNames = clipTags.map(t => t.tag);
        result.combinedTags = tagNames;
        
        // Determine primary category from CLIP results
        result.primaryCategory = this.determineCategoryFromTags(tagNames);
        
        // Set autoTags based on CLIP analysis
        result.autoTags = this.convertToAutoTags(tagNames, originalFilename);
      }
    }

    // 2. Add filename-based tags (Secondary Task - only if useful)
    const filenameTags = this.extractFilenameTags(originalFilename);
    result.filenameTags = filenameTags;
    
    // Add filename tags that aren't already in CLIP tags
    if (filenameTags.length > 0) {
      const newTags = filenameTags.filter(ft => 
        !result.combinedTags.some(ct => 
          ct.toLowerCase().includes(ft.toLowerCase()) || 
          ft.toLowerCase().includes(ct.toLowerCase())
        )
      );
      result.combinedTags = [...result.combinedTags, ...newTags].slice(0, 7);
    }

    // 3. If CLIP failed, use filename-only tagging
    if (result.method === 'filename' && filenameTags.length > 0) {
      result.combinedTags = filenameTags;
      result.primaryCategory = this.determineCategoryFromTags(filenameTags);
      result.autoTags = this.convertToAutoTags(filenameTags, originalFilename);
    }

    // 4. If still no tags, use hash-based fallback
    if (result.combinedTags.length === 0) {
      result.combinedTags = ['uncategorized'];
      result.autoTags = this.hashBasedFallback(originalFilename);
      result.method = 'hash-fallback';
    }

    console.log(`✅ Final tags (${result.method}):`, result.combinedTags.join(', '));
    
    return result;
  }

  /**
   * Determine primary category from tags
   */
  determineCategoryFromTags(tags) {
    const tagString = tags.join(' ').toLowerCase();
    
    // Check for person-related tags
    const personKeywords = ['person', 'people', 'face', 'portrait', 'selfie', 'man', 'woman', 'child', 'group'];
    if (personKeywords.some(k => tagString.includes(k))) return 'person';
    
    // Check for pet-related tags
    const petKeywords = ['dog', 'cat', 'pet', 'animal', 'puppy', 'kitten', 'bird'];
    if (petKeywords.some(k => tagString.includes(k))) return 'pet';
    
    // Check for vehicle-related tags
    const vehicleKeywords = ['car', 'vehicle', 'motorcycle', 'bicycle', 'truck', 'bus', 'driving'];
    if (vehicleKeywords.some(k => tagString.includes(k))) return 'vehicle';
    
    // Check for nature-related tags
    const natureKeywords = ['nature', 'outdoor', 'beach', 'mountain', 'forest', 'sunset', 'sky', 'flower', 'tree', 'lake', 'ocean'];
    if (natureKeywords.some(k => tagString.includes(k))) return 'nature';
    
    return 'uncategorized';
  }

  /**
   * Convert tags to autoTags format for database storage
   */
  convertToAutoTags(tags, filename) {
    const autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: [...tags]
    };

    const tagString = tags.join(' ').toLowerCase();
    
    // Detect person
    if (['person', 'people', 'face', 'portrait', 'selfie'].some(k => tagString.includes(k))) {
      autoTags.person_id = this.generatePersonId(filename);
    }
    
    // Detect pet
    if (['dog', 'cat', 'pet', 'animal', 'puppy', 'kitten'].some(k => tagString.includes(k))) {
      autoTags.pets = true;
    }
    
    // Detect vehicle
    if (['car', 'vehicle', 'motorcycle', 'bicycle', 'truck'].some(k => tagString.includes(k))) {
      autoTags.vehicle = true;
    }
    
    // Detect nature
    if (['nature', 'outdoor', 'beach', 'mountain', 'forest', 'sunset', 'flower', 'tree'].some(k => tagString.includes(k))) {
      autoTags.nature = true;
    }

    return autoTags;
  }

  /**
   * Generate person ID from filename hash
   */
  generatePersonId(filename) {
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
      hash = ((hash << 5) - hash) + filename.charCodeAt(i);
      hash = hash & hash;
    }
    return `person_${String(Math.abs(hash) % 10000).padStart(4, '0')}`;
  }

  /**
   * Hash-based fallback for completely unknown images
   */
  hashBasedFallback(filename) {
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
      hash = ((hash << 5) - hash) + filename.charCodeAt(i);
      hash = hash & hash;
    }
    
    const category = Math.abs(hash) % 4;
    const autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: ['uncategorized']
    };
    
    switch(category) {
      case 0: autoTags.person_id = this.generatePersonId(filename); break;
      case 1: autoTags.pets = true; break;
      case 2: autoTags.nature = true; break;
      case 3: autoTags.vehicle = true; break;
    }
    
    return autoTags;
  }

  /**
   * Get model status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      model: this.isInitialized ? 'Xenova/clip-vit-base-patch32' : 'Not loaded',
      method: this.isInitialized ? 'CLIP + Filename' : 'Filename only',
      totalTags: ALL_TAGS.length
    };
  }
}

// Export singleton instance
const clipTagger = new CLIPTagger();

module.exports = clipTagger;
module.exports.CLIPTagger = CLIPTagger;
module.exports.TAG_CATEGORIES = TAG_CATEGORIES;
module.exports.ALL_TAGS = ALL_TAGS;
