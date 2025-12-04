/**
 * Image Processing and Tagging Service
 * Analyzes embeddings and applies auto-tagging
 * 
 * Categories can be MULTIPLE - an image can have multiple tags
 * and will be copied to ALL matching folders
 */

// Store for tracking person embeddings to group same people together
const personEmbeddingStore = new Map();

class ImageProcessor {
  /**
   * Analyze embedding and generate tags
   * @param {Array} embedding - Image embedding vector
   * @param {String} filename - Original filename
   * @returns {Object} Auto-generated tags
   */
  static analyzeEmbedding(embedding, filename) {
    const autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: []
    };

    // First, check filename for explicit hints
    const filenameHints = this.analyzeFilename(filename);
    
    if (!embedding || embedding.length === 0) {
      return filenameHints;
    }

    // Determine ALL matching categories (not mutually exclusive)
    const categories = this.determineCategories(embedding, filename);
    
    // Apply all detected categories
    if (categories.includes('vehicle')) {
      autoTags.vehicle = true;
      autoTags.objects.push('vehicle');
    }
    
    if (categories.includes('pet')) {
      autoTags.pets = true;
      autoTags.objects.push('animal');
    }
    
    if (categories.includes('nature')) {
      autoTags.nature = true;
      autoTags.objects.push('landscape', 'outdoor');
    }
    
    if (categories.includes('person')) {
      autoTags.person_id = this.findOrCreatePersonId(embedding, filename);
      autoTags.objects.push('portrait');
    }
    
    // If no categories matched, mark as uncategorized
    if (categories.length === 0 || (categories.length === 1 && categories.includes('other'))) {
      autoTags.objects.push('uncategorized');
    }

    return autoTags;
  }

  /**
   * Determine ALL matching categories for an image
   * Returns array of all matching categories
   */
  static determineCategories(embedding, filename) {
    const lowerName = filename.toLowerCase();
    const categories = [];
    
    // Check for Vehicle/Car keywords
    if (lowerName.match(/\b(car|vehicle|auto|automobile|truck|bike|motorcycle|bus|van|suv|jeep|tesla|bmw|audi|honda|toyota|ford|mercedes|driving|saveclip)\b/)) {
      categories.push('vehicle');
    }
    
    // Check for Pet keywords - expanded list
    if (lowerName.match(/\b(dog|cat|pet|puppy|kitten|animal|bird|fish|parrot|rabbit|hamster|cow|horse|goat|sheep|pug|labrador|german|shepherd|bulldog|poodle|beagle|husky|corgi|golden|retriever|persian|siamese|tabby|kitty|doggy|pup|fauna)\b/)) {
      categories.push('pet');
    }
    
    // Check for Nature keywords - expanded list
    if (lowerName.match(/\b(nature|landscape|mountain|beach|forest|sunset|sunrise|scenery|view|tree|flower|garden|park|lake|river|ocean|sea|sky|cloud|leaf|plant|flora|waterfall|hill|valley|meadow|field|grass|outdoor|woods)\b/)) {
      categories.push('nature');
    }
    
    // Check for Person keywords - expanded list
    if (lowerName.match(/\b(person|face|portrait|selfie|profile|me|myself|family|friend|people|group|man|woman|boy|girl|baby|child|human|wedding|birthday|party|graduation|whatsapp)\b/)) {
      categories.push('person');
    }
    
    // NOTE: IMG_ and DSC_ files are NOT automatically classified as person
    // They will be "uncategorized" so user can manually tag them
    // This prevents wrong classification of pet/nature/vehicle photos
    
    // If still no categories, mark as other/uncategorized
    if (categories.length === 0) {
      categories.push('other');
    }
    
    return categories;
  }

  /**
   * Find existing person ID or create new one based on embedding similarity
   * Groups similar faces together
   */
  static findOrCreatePersonId(embedding, filename) {
    // Generate a signature from the embedding for comparison
    const signature = this.generateEmbeddingSignature(embedding);
    
    // Check existing person embeddings for similarity
    for (const [personId, storedSignature] of personEmbeddingStore) {
      const similarity = this.calculateSimilarity(signature, storedSignature);
      
      // If similarity is high enough, use existing person ID
      if (similarity > 0.85) {
        console.log(`Matched to existing person: ${personId} (similarity: ${similarity.toFixed(2)})`);
        return personId;
      }
    }
    
    // Create new person ID
    const newPersonId = `person_${String(personEmbeddingStore.size + 1).padStart(4, '0')}`;
    personEmbeddingStore.set(newPersonId, signature);
    console.log(`Created new person: ${newPersonId}`);
    
    return newPersonId;
  }

  /**
   * Generate a compact signature from embedding for comparison
   */
  static generateEmbeddingSignature(embedding) {
    // Create a simplified signature for comparison
    const segmentSize = Math.floor(embedding.length / 8);
    const signature = [];
    
    for (let i = 0; i < 8; i++) {
      const segment = embedding.slice(i * segmentSize, (i + 1) * segmentSize);
      const avg = segment.reduce((a, b) => a + b, 0) / segment.length;
      signature.push(avg);
    }
    
    return signature;
  }

  /**
   * Calculate similarity between two signatures (0-1)
   */
  static calculateSimilarity(sig1, sig2) {
    if (sig1.length !== sig2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < sig1.length; i++) {
      dotProduct += sig1[i] * sig2[i];
      norm1 += sig1[i] * sig1[i];
      norm2 += sig2[i] * sig2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Analyze filename for tag hints - supports MULTIPLE tags
   */
  static analyzeFilename(filename) {
    const lowerName = filename.toLowerCase();
    const autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: []
    };

    let hasMatch = false;

    // Check for vehicle/car keywords
    if (lowerName.match(/\b(car|vehicle|auto|automobile|truck|bike|motorcycle|bus|van|suv|jeep|tesla|bmw|audi|honda|toyota|ford|mercedes|driving|saveclip)\b/)) {
      autoTags.vehicle = true;
      autoTags.objects.push('vehicle');
      hasMatch = true;
    }

    // Check for pet keywords - expanded
    if (lowerName.match(/\b(dog|cat|pet|puppy|kitten|animal|bird|parrot|rabbit|hamster|cow|horse|goat|sheep|pug|labrador|bulldog|poodle|beagle|husky|corgi|persian|siamese|kitty|doggy|pup|fauna)\b/)) {
      autoTags.pets = true;
      autoTags.objects.push('animal');
      hasMatch = true;
    }

    // Check for nature keywords - expanded
    if (lowerName.match(/\b(nature|landscape|mountain|beach|forest|sunset|sky|scenery|tree|flower|garden|lake|river|ocean|leaf|plant|flora|waterfall|meadow|field|outdoor|woods)\b/)) {
      autoTags.nature = true;
      autoTags.objects.push('outdoor');
      hasMatch = true;
    }

    // Check for person keywords - expanded
    if (lowerName.match(/\b(person|face|portrait|selfie|profile|family|friend|people|group|man|woman|boy|girl|baby|child|human|wedding|birthday|party|whatsapp)\b/)) {
      autoTags.person_id = `person_0001`;
      autoTags.objects.push('portrait');
      hasMatch = true;
    }

    // NOTE: IMG_ files are NOT auto-classified - they stay uncategorized for manual tagging

    // If no match, mark as uncategorized
    if (!hasMatch) {
      autoTags.objects.push('uncategorized');
    }

    return autoTags;
  }

  /**
   * Generate a simple embedding if none provided
   */
  static generateSimpleEmbedding(filename) {
    const embedding = [];
    const normalizedName = this.normalizeFilename(filename);
    const seed = normalizedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < 128; i++) {
      const value = Math.sin(seed * (i + 1) * 0.01) * 0.5 + 0.5;
      embedding.push(parseFloat(value.toFixed(4)));
    }
    
    return embedding;
  }

  /**
   * Normalize filename to group similar images together
   */
  static normalizeFilename(filename) {
    let normalized = filename.toLowerCase();
    
    if (normalized.includes('whatsapp')) {
      normalized = 'whatsapp_image';
    }
    
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}/g, '');
    normalized = normalized.replace(/\d{10,}/g, '');
    normalized = normalized.replace(/-\d{2}\./g, '.');
    
    return normalized;
  }

  /**
   * Get ALL folder paths for an image based on ALL its tags
   * Returns array of folder paths - image will be copied to each
   */
  static getAllFolderPaths(autoTags, customTags = []) {
    const folders = [];
    
    // Add folder for each detected category
    if (autoTags.vehicle) {
      folders.push('vehicles');
    }
    
    if (autoTags.pets) {
      folders.push('pets');
    }
    
    if (autoTags.nature) {
      folders.push('nature');
    }
    
    if (autoTags.person_id) {
      folders.push(`people/${autoTags.person_id}`);
    }

    // Add custom tag folders
    for (const tag of customTags) {
      if (tag && tag.trim()) {
        folders.push(`tags/${tag.trim()}`);
      }
    }

    // If no folders, put in uncategorized
    if (folders.length === 0) {
      folders.push('uncategorized');
    }

    return folders;
  }

  /**
   * Determine single primary folder path (for backward compatibility)
   */
  static determineFolderPath(autoTags, customTags = []) {
    const folders = this.getAllFolderPaths(autoTags, customTags);
    return folders[0];
  }

  /**
   * Clear person store (useful for resetting)
   */
  static clearPersonStore() {
    personEmbeddingStore.clear();
  }

  /**
   * Get all tracked person IDs
   */
  static getTrackedPersons() {
    return Array.from(personEmbeddingStore.keys());
  }
}

module.exports = ImageProcessor;
