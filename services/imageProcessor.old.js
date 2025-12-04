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
    if (categories.length === 0 || categories.includes('other')) {
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
    if (lowerName.match(/\b(car|vehicle|auto|automobile|truck|bike|motorcycle|bus|van|suv|jeep|tesla|bmw|audi|honda|toyota|ford|mercedes|driving)\b/)) {
      categories.push('vehicle');
    }
    
    // Check for Pet keywords
    if (lowerName.match(/\b(dog|cat|pet|puppy|kitten|animal|bird|fish|parrot|rabbit|hamster|cow|horse|goat|sheep)\b/)) {
      categories.push('pet');
    }
    
    // Check for Nature keywords
    if (lowerName.match(/\b(nature|landscape|mountain|beach|forest|sunset|sunrise|scenery|view|tree|flower|garden|park|lake|river|ocean|sea|sky|cloud|leaf|plant)\b/)) {
      categories.push('nature');
    }
    
    // Check for Person keywords
    if (lowerName.match(/\b(person|face|portrait|selfie|profile|me|myself|family|friend|people|group|man|woman|boy|girl|baby|child)\b/)) {
      categories.push('person');
    }
    
    // For WhatsApp images - assume person
    if (lowerName.includes('whatsapp') && categories.length === 0) {
      categories.push('person');
    }
    
    // For IMG_ or photo_ prefixed files - assume person
    if (lowerName.match(/^(img_|photo_|dsc)/i) && categories.length === 0) {
      categories.push('person');
    }
    
    // If still no categories, mark as other
    if (categories.length === 0) {
      categories.push('other');
    }
    
    return categories;
  }
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
   * Analyze filename for tag hints
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

    // Check for vehicle/car keywords FIRST
    if (lowerName.match(/\b(car|vehicle|auto|automobile|truck|bike|motorcycle|bus|van|suv|jeep|tesla|bmw|audi|honda|toyota|ford|mercedes|driving)\b/)) {
      autoTags.vehicle = true;
      autoTags.objects.push('vehicle');
      return autoTags;
    }

    // Check for explicit pet keywords
    if (lowerName.match(/\b(dog|cat|pet|puppy|kitten|animal|bird|parrot|rabbit|hamster)\b/)) {
      autoTags.pets = true;
      autoTags.objects.push('animal');
      return autoTags;
    }

    // Check for explicit nature keywords
    if (lowerName.match(/\b(nature|landscape|mountain|beach|forest|sunset|sky|scenery|tree|flower|garden|lake|river|ocean)\b/)) {
      autoTags.nature = true;
      autoTags.objects.push('outdoor');
      return autoTags;
    }

    // WhatsApp images - assume person
    if (lowerName.includes('whatsapp')) {
      autoTags.person_id = `person_0001`;
      autoTags.objects.push('portrait');
      return autoTags;
    }

    // DEFAULT: uncategorized for unknown images
    autoTags.objects.push('uncategorized');
    return autoTags;
  }

  /**
   * Generate a simple embedding if none provided
   * In real app, this would use a pre-trained model like ResNet, CLIP, etc.
   */
  static generateSimpleEmbedding(filename) {
    // Generate a 128-dimensional embedding based on filename
    // Same filename pattern = same embedding = same person ID
    const embedding = [];
    
    // Create a deterministic seed from filename
    // Normalize to group similar files together
    const normalizedName = this.normalizeFilename(filename);
    const seed = normalizedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < 128; i++) {
      // Use seed for reproducibility - same file patterns get similar embeddings
      const value = Math.sin(seed * (i + 1) * 0.01) * 0.5 + 0.5;
      embedding.push(parseFloat(value.toFixed(4)));
    }
    
    return embedding;
  }

  /**
   * Normalize filename to group similar images together
   * E.g., "WhatsApp Image 2025-11-29" files from same source get similar treatment
   */
  static normalizeFilename(filename) {
    let normalized = filename.toLowerCase();
    
    // For WhatsApp images, keep the base pattern to group them
    if (normalized.includes('whatsapp')) {
      // Remove date/time variations to group WhatsApp images together
      normalized = 'whatsapp_image';
    }
    
    // Remove timestamps and random numbers for grouping
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}/g, '');
    normalized = normalized.replace(/\d{10,}/g, '');
    normalized = normalized.replace(/-\d{2}\./g, '.');
    
    return normalized;
  }

  /**
   * Determine folder path based on tags
   * Priority: vehicle > pet > nature > person > uncategorized
   */
  static determineFolderPath(autoTags, customTags = []) {
    // Primary categorization - MUTUALLY EXCLUSIVE
    // Check specific object categories FIRST before person
    
    if (autoTags.vehicle) {
      return 'vehicles';
    }
    
    if (autoTags.pets) {
      return 'pets';
    }
    
    if (autoTags.nature) {
      return 'nature';
    }
    
    if (autoTags.person_id) {
      return `people/${autoTags.person_id}`;
    }

    // Add custom tag folders
    if (customTags.length > 0) {
      return `tags/${customTags[0]}`;
    }

    return 'uncategorized';
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
