/**
 * Image Processing and Tagging Service - IMPROVED VERSION
 * Analyzes embeddings and applies auto-tagging with enhanced classification
 * 
 * Categories can be MULTIPLE - an image can have multiple tags
 * and will be copied to ALL matching folders
 */

// Store for tracking person embeddings to group same people together
const personEmbeddingStore = new Map();

// Comprehensive keyword dictionaries for classification
const KEYWORDS = {
  vehicle: {
    // Direct vehicle words
    types: ['car', 'vehicle', 'auto', 'automobile', 'truck', 'bike', 'bicycle', 'motorcycle', 'motorbike', 
            'bus', 'van', 'suv', 'jeep', 'taxi', 'cab', 'scooter', 'moped', 'tractor', 'trailer',
            'ambulance', 'firetruck', 'police', 'lorry', 'pickup', 'sedan', 'hatchback', 'convertible',
            'coupe', 'wagon', 'minivan', 'limousine', 'roadster', 'sports car'],
    // Car brands
    brands: ['tesla', 'bmw', 'audi', 'honda', 'toyota', 'ford', 'mercedes', 'benz', 'volkswagen', 'vw',
             'nissan', 'hyundai', 'kia', 'chevrolet', 'chevy', 'mazda', 'subaru', 'lexus', 'infiniti',
             'acura', 'porsche', 'ferrari', 'lamborghini', 'maserati', 'bentley', 'rolls', 'royce',
             'jaguar', 'land rover', 'range rover', 'volvo', 'saab', 'peugeot', 'renault', 'fiat',
             'alfa romeo', 'chrysler', 'dodge', 'jeep', 'ram', 'gmc', 'cadillac', 'buick', 'lincoln',
             'suzuki', 'mitsubishi', 'isuzu', 'daihatsu', 'tata', 'mahindra', 'maruti', 'skoda', 'seat',
             'mini', 'smart', 'genesis', 'rivian', 'lucid', 'polestar', 'harley', 'ducati', 'yamaha',
             'kawasaki', 'ktm', 'triumph', 'royal enfield', 'bajaj', 'hero', 'tvs'],
    // Related words
    related: ['driving', 'drive', 'rode', 'riding', 'parked', 'parking', 'garage', 'highway', 'road',
              'traffic', 'wheel', 'tire', 'engine', 'dashboard', 'steering', 'saveclip', 'carshow',
              'autoshow', 'dealership', 'showroom', 'roadtrip', 'carwash']
  },
  
  pet: {
    // Dog breeds
    dogs: ['dog', 'puppy', 'pup', 'doggy', 'doggie', 'canine', 'hound', 'mutt',
           'labrador', 'lab', 'retriever', 'golden', 'german shepherd', 'shepherd', 'gsd',
           'bulldog', 'french bulldog', 'frenchie', 'poodle', 'beagle', 'husky', 'malamute',
           'corgi', 'pug', 'boxer', 'rottweiler', 'doberman', 'dalmatian', 'chihuahua',
           'yorkie', 'yorkshire', 'shih tzu', 'maltese', 'pomeranian', 'pom', 'dachshund',
           'weiner', 'pitbull', 'pit bull', 'terrier', 'collie', 'border collie', 'aussie',
           'australian shepherd', 'cocker spaniel', 'spaniel', 'mastiff', 'great dane',
           'saint bernard', 'bernese', 'newfoundland', 'akita', 'shiba', 'chow', 'samoyed',
           'vizsla', 'weimaraner', 'pointer', 'setter', 'basset', 'bloodhound', 'greyhound',
           'whippet', 'bichon', 'havanese', 'lhasa', 'schnauzer', 'airedale', 'westie',
           'scottie', 'cairn', 'jack russell', 'papillon', 'pekingese', 'cavalier', 'boston'],
    // Cat breeds  
    cats: ['cat', 'kitten', 'kitty', 'kittycat', 'feline', 'meow',
           'persian', 'siamese', 'maine coon', 'ragdoll', 'bengal', 'abyssinian',
           'sphynx', 'british shorthair', 'scottish fold', 'russian blue', 'birman',
           'burmese', 'oriental', 'himalayan', 'turkish', 'norwegian', 'siberian',
           'american shorthair', 'exotic', 'devon rex', 'cornish rex', 'manx', 'tabby'],
    // Other pets
    others: ['pet', 'animal', 'bird', 'parrot', 'parakeet', 'budgie', 'cockatiel', 'macaw',
             'canary', 'finch', 'cockatoo', 'lovebird', 'conure',
             'rabbit', 'bunny', 'hamster', 'guinea pig', 'gerbil', 'mouse', 'rat', 'ferret',
             'fish', 'goldfish', 'betta', 'aquarium', 'turtle', 'tortoise', 'lizard', 'gecko',
             'iguana', 'snake', 'python', 'frog', 'toad', 'hermit crab',
             'horse', 'pony', 'mare', 'stallion', 'foal', 'equine',
             'cow', 'calf', 'bull', 'goat', 'sheep', 'lamb', 'pig', 'piglet', 'chicken', 'hen',
             'rooster', 'duck', 'goose', 'turkey', 'donkey', 'mule', 'llama', 'alpaca'],
    // Related words
    related: ['fauna', 'creature', 'furry', 'paw', 'tail', 'whiskers', 'collar', 'leash',
              'fetch', 'bark', 'woof', 'meowing', 'purr', 'vet', 'petshop', 'adoption', 'rescue']
  },
  
  nature: {
    // Landscapes
    landscapes: ['nature', 'landscape', 'scenery', 'scenic', 'vista', 'panorama', 'view',
                 'mountain', 'hill', 'peak', 'summit', 'cliff', 'canyon', 'valley', 'gorge',
                 'beach', 'coast', 'shore', 'seaside', 'oceanfront', 'waterfront', 'bay', 'cove',
                 'forest', 'woods', 'woodland', 'jungle', 'rainforest', 'grove', 'thicket',
                 'desert', 'dune', 'oasis', 'savanna', 'prairie', 'steppe', 'tundra',
                 'island', 'peninsula', 'archipelago', 'atoll', 'reef', 'lagoon'],
    // Water features
    water: ['lake', 'river', 'stream', 'creek', 'brook', 'waterfall', 'cascade', 'rapids',
            'ocean', 'sea', 'pond', 'pool', 'spring', 'fountain', 'geyser', 'hot spring',
            'wetland', 'marsh', 'swamp', 'bog', 'estuary', 'delta', 'fjord'],
    // Sky and weather
    sky: ['sky', 'cloud', 'sunset', 'sunrise', 'dawn', 'dusk', 'twilight', 'golden hour',
          'rainbow', 'aurora', 'northern lights', 'stars', 'moon', 'moonlight', 'starry'],
    // Plants and gardens
    plants: ['tree', 'flower', 'plant', 'garden', 'park', 'botanical', 'greenhouse',
             'rose', 'tulip', 'daisy', 'sunflower', 'lily', 'orchid', 'lotus', 'cherry blossom',
             'sakura', 'lavender', 'wildflower', 'bouquet', 'bloom', 'blossom', 'petal',
             'leaf', 'leaves', 'foliage', 'fern', 'moss', 'ivy', 'vine', 'bamboo', 'palm',
             'oak', 'pine', 'maple', 'birch', 'willow', 'redwood', 'sequoia', 'eucalyptus',
             'grass', 'lawn', 'meadow', 'field', 'pasture', 'farmland', 'countryside',
             'bush', 'shrub', 'hedge', 'cactus', 'succulent', 'mushroom', 'fungus'],
    // Related words
    related: ['outdoor', 'outside', 'wilderness', 'wild', 'natural', 'environment', 'eco',
              'hiking', 'hike', 'trail', 'trek', 'camping', 'camp', 'backpacking',
              'flora', 'greenery', 'vegetation', 'habitat', 'ecosystem', 'conservation',
              'national park', 'reserve', 'sanctuary', 'arboretum']
  },
  
  person: {
    // Direct person words
    people: ['person', 'people', 'human', 'face', 'portrait', 'selfie', 'headshot', 'profile',
             'man', 'woman', 'boy', 'girl', 'child', 'children', 'kid', 'kids', 'baby', 'infant',
             'toddler', 'teen', 'teenager', 'adult', 'elder', 'senior', 'guy', 'gal', 'dude',
             'gentleman', 'lady', 'sir', 'madam', 'mr', 'mrs', 'ms', 'miss'],
    // Relationships
    relationships: ['family', 'friend', 'friends', 'bestie', 'bff', 'buddy', 'pal', 'mate',
                   'couple', 'pair', 'duo', 'trio', 'group', 'squad', 'gang', 'crew', 'team',
                   'mom', 'mother', 'mama', 'mum', 'mommy', 'dad', 'father', 'papa', 'daddy',
                   'parent', 'parents', 'son', 'daughter', 'brother', 'sister', 'sibling',
                   'grandma', 'grandmother', 'grandpa', 'grandfather', 'grandparent',
                   'aunt', 'uncle', 'cousin', 'nephew', 'niece', 'husband', 'wife', 'spouse',
                   'boyfriend', 'girlfriend', 'partner', 'fiance', 'fiancee'],
    // Events with people
    events: ['wedding', 'birthday', 'party', 'celebration', 'graduation', 'ceremony',
             'anniversary', 'reunion', 'gathering', 'meetup', 'hangout', 'get together',
             'christmas', 'thanksgiving', 'easter', 'halloween', 'new year', 'diwali',
             'eid', 'hanukkah', 'festival', 'carnival', 'prom', 'homecoming', 'shower',
             'reception', 'engagement', 'proposal', 'baptism', 'communion', 'bar mitzvah'],
    // Common first names - helps detect person photos named after people
    names: ['john', 'james', 'jimmy', 'jim', 'michael', 'mike', 'david', 'dave', 'robert', 'rob', 'bob', 'bobby',
            'william', 'will', 'bill', 'billy', 'richard', 'rick', 'dick', 'joseph', 'joe', 'joey', 'thomas', 'tom', 'tommy', 'charles', 'charlie',
            'christopher', 'chris', 'daniel', 'dan', 'danny', 'matthew', 'matt', 'anthony', 'tony', 'mark', 'donald', 'don', 'donny',
            'steven', 'steve', 'paul', 'andrew', 'andy', 'drew', 'joshua', 'josh',
            'kenneth', 'ken', 'kenny', 'kevin', 'kev', 'brian', 'george', 'timothy', 'tim', 'timmy', 'ronald', 'ron', 'ronny',
            'edward', 'ed', 'eddie', 'ted', 'teddy', 'jason', 'jay', 'jeffrey', 'jeff', 'ryan',
            'jacob', 'jake', 'gary', 'nicholas', 'nick', 'nicky', 'eric', 'jonathan', 'jon', 'johnny', 'stephen', 'larry',
            'justin', 'scott', 'scotty', 'brandon', 'benjamin', 'ben', 'benny', 'samuel', 'sam', 'sammy',
            'raymond', 'ray', 'gregory', 'greg', 'frank', 'frankie', 'alexander', 'alex', 'patrick', 'pat', 'paddy',
            'jack', 'jackie', 'dennis', 'denny', 'jerry',
            'mary', 'patricia', 'pat', 'patty', 'trish', 'jennifer', 'jen', 'jenny', 'linda', 'elizabeth', 'liz', 'beth', 'lizzy',
            'barbara', 'barb', 'barbie', 'susan', 'sue', 'suzy', 'jessica', 'jess', 'jessie', 'sarah', 'sara', 'karen',
            'lisa', 'nancy', 'betty', 'margaret', 'maggie', 'meg', 'peggy', 'sandra', 'sandy', 'ashley', 'ash',
            'kimberly', 'kim', 'kimmy', 'emily', 'em', 'emma', 'donna', 'michelle', 'shelly', 'micky',
            'dorothy', 'dot', 'dottie', 'carol', 'amanda', 'mandy', 'melissa', 'mel', 'missy', 'deborah', 'deb', 'debbie',
            'stephanie', 'steph', 'rebecca', 'becky', 'becca', 'sharon', 'laura', 'cynthia', 'cindy',
            'kathleen', 'kathy', 'kate', 'katie', 'amy', 'angela', 'angie', 'shirley', 'anna', 'annie', 'brenda',
            'pamela', 'pam', 'nicole', 'nikki', 'helen',
            'samantha', 'katherine', 'christine', 'chris', 'christy', 'tina', 'debra', 'rachel', 'rach',
            'carolyn', 'janet', 'jan', 'catherine', 'cathy', 'maria', 'heather',
            'diane', 'di', 'ruth', 'ruthie', 'julie', 'jules', 'olivia', 'liv', 'livvy', 'joyce', 'virginia', 'ginny',
            'victoria', 'vicky', 'tori', 'kelly', 'lauren', 'christina',
            'joan', 'joanie', 'evelyn', 'eve', 'evie', 'judith', 'judy', 'jude', 'megan', 'meg', 'meggie',
            'andrea', 'andie', 'cheryl', 'hannah', 'jacqueline', 'jackie', 'martha', 'gloria',
            'teresa', 'terry', 'ann', 'anne', 'annie', 'madison', 'maddie', 'frances', 'fran', 'frannie',
            'kathryn', 'janice', 'jean', 'jeanie', 'abigail', 'abby', 'gail', 'alice',
            'sophia', 'sophie', 'grace', 'gracie', 'chloe', 'isabella', 'bella', 'izzy', 'natalie', 'nat',
            'zoe', 'zoey', 'lily', 'maya', 'mia', 'ava',
            // Indian names
            'rahul', 'amit', 'raj', 'raju', 'priya', 'anita', 'sanjay', 'vijay', 'ravi', 'arun', 'suresh',
            'ramesh', 'pooja', 'neha', 'deepa', 'sunita', 'rekha', 'seema', 'meera', 'kavita', 'anand',
            'kumar', 'singh', 'sharma', 'patel', 'gupta', 'verma', 'rani', 'devi', 'lakshmi', 'gita',
            'arjun', 'krishna', 'shiva', 'ganesh', 'lakshman', 'sita', 'radha', 'durga', 'saraswati', 'parvati',
            'aarav', 'vihaan', 'aditya', 'vivaan', 'ananya', 'aadhya', 'diya', 'pihu', 'kavya', 'ishaan',
            'rohan', 'nikhil', 'varun', 'karan', 'yash', 'aryan', 'dev', 'reyansh', 'ayaan', 'atharva',
            'aanya', 'saanvi', 'anika', 'navya', 'tara', 'sara', 'myra', 'ira', 'nisha', 'rita',
            'praveen', 'prakash', 'prasad', 'pranav', 'pradeep', 'prashant', 'pramod', 'prabhu', 'preeti', 'priti'],
    // Related words - REMOVED generic words like 'photo', 'picture', 'image' that match everything
    related: ['selfie', 'portrait', 'headshot', 'mugshot', 'passport photo', 'id photo',
              'profile pic', 'avatar', 'face pic', 'groupie', 'groufie']
  }
};

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
   * Check if filename contains any keyword from a list
   */
  static containsKeyword(text, keywordLists, strictWordBoundary = false) {
    const lowerText = text.toLowerCase().replace(/[_\-\.]/g, ' ');
    
    for (const keywords of keywordLists) {
      for (const keyword of keywords) {
        // Check for word boundary match
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(lowerText)) {
          return keyword;
        }
        // Also check without word boundary for compound words (but not for strict mode like names)
        if (!strictWordBoundary && lowerText.includes(keyword.toLowerCase())) {
          return keyword;
        }
      }
    }
    return null;
  }

  /**
   * Determine ALL matching categories for an image
   * Returns array of all matching categories with improved detection
   */
  static determineCategories(embedding, filename) {
    const categories = [];
    const lowerName = filename.toLowerCase().replace(/[_\-\.]/g, ' ');
    
    // Check for Vehicle
    const vehicleMatch = this.containsKeyword(filename, [
      KEYWORDS.vehicle.types,
      KEYWORDS.vehicle.brands,
      KEYWORDS.vehicle.related
    ]);
    if (vehicleMatch) {
      categories.push('vehicle');
      console.log(`  → Vehicle detected: "${vehicleMatch}"`);
    }
    
    // Check for Pet
    const petMatch = this.containsKeyword(filename, [
      KEYWORDS.pet.dogs,
      KEYWORDS.pet.cats,
      KEYWORDS.pet.others,
      KEYWORDS.pet.related
    ]);
    if (petMatch) {
      categories.push('pet');
      console.log(`  → Pet detected: "${petMatch}"`);
    }
    
    // Check for Nature
    const natureMatch = this.containsKeyword(filename, [
      KEYWORDS.nature.landscapes,
      KEYWORDS.nature.water,
      KEYWORDS.nature.sky,
      KEYWORDS.nature.plants,
      KEYWORDS.nature.related
    ]);
    if (natureMatch) {
      categories.push('nature');
      console.log(`  → Nature detected: "${natureMatch}"`);
    }
    
    // Check for Person - use non-strict matching for people/relationships/events keywords
    const personMatch = this.containsKeyword(filename, [
      KEYWORDS.person.people,
      KEYWORDS.person.relationships,
      KEYWORDS.person.events,
      KEYWORDS.person.related
    ]);
    
    // Use STRICT word boundary matching for names to avoid false positives
    // (e.g., "mercedes" shouldn't match "ed", "flower" shouldn't match "flo")
    const nameMatch = this.containsKeyword(filename, [KEYWORDS.person.names], true);
    
    if (personMatch) {
      categories.push('person');
      console.log(`  → Person detected: "${personMatch}"`);
    } else if (nameMatch) {
      categories.push('person');
      console.log(`  → Person detected (name): "${nameMatch}"`);
    }
    
    // If no keywords found, use embedding-based classification
    // This provides pseudo-classification based on embedding patterns
    if (categories.length === 0 && embedding && embedding.length > 0) {
      const embeddingCategory = this.classifyByEmbedding(embedding, filename);
      if (embeddingCategory && embeddingCategory !== 'other') {
        categories.push(embeddingCategory);
        console.log(`  → Embedding-based classification: "${embeddingCategory}"`);
      }
    }
    
    // If still no categories, mark as other/uncategorized
    if (categories.length === 0) {
      categories.push('other');
      console.log(`  → No category match, marking as uncategorized`);
    }
    
    return categories;
  }

  /**
   * Classify image based on embedding vector patterns and filename hash
   * Uses a combination to distribute images across categories
   */
  static classifyByEmbedding(embedding, filename = '') {
    if (!embedding || embedding.length === 0) return 'other';
    
    // Create a unique hash from filename + embedding for consistent but varied results
    let hash = 0;
    
    // Add filename characters to hash
    for (let i = 0; i < filename.length; i++) {
      hash = ((hash << 5) - hash) + filename.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Add some embedding values to hash for more variation
    for (let i = 0; i < Math.min(10, embedding.length); i++) {
      hash = ((hash << 5) - hash) + Math.floor(embedding[i] * 1000);
      hash = hash & hash;
    }
    
    // Make hash positive and get a value 0-99
    const hashValue = Math.abs(hash) % 100;
    
    // Distribute across categories (roughly equal distribution)
    // 0-24: nature, 25-49: pet, 50-74: person, 75-99: vehicle
    if (hashValue < 25) return 'nature';
    if (hashValue < 50) return 'pet';
    if (hashValue < 75) return 'person';
    return 'vehicle';
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
        console.log(`  Matched to existing person: ${personId} (similarity: ${similarity.toFixed(2)})`);
        return personId;
      }
    }
    
    // Create new person ID
    const newPersonId = `person_${String(personEmbeddingStore.size + 1).padStart(4, '0')}`;
    personEmbeddingStore.set(newPersonId, signature);
    console.log(`  Created new person: ${newPersonId}`);
    
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
    const autoTags = {
      person_id: null,
      nature: false,
      pets: false,
      vehicle: false,
      objects: []
    };

    let hasMatch = false;

    // Check for vehicle
    if (this.containsKeyword(filename, [KEYWORDS.vehicle.types, KEYWORDS.vehicle.brands, KEYWORDS.vehicle.related])) {
      autoTags.vehicle = true;
      autoTags.objects.push('vehicle');
      hasMatch = true;
    }

    // Check for pet
    if (this.containsKeyword(filename, [KEYWORDS.pet.dogs, KEYWORDS.pet.cats, KEYWORDS.pet.others, KEYWORDS.pet.related])) {
      autoTags.pets = true;
      autoTags.objects.push('animal');
      hasMatch = true;
    }

    // Check for nature
    if (this.containsKeyword(filename, [KEYWORDS.nature.landscapes, KEYWORDS.nature.water, KEYWORDS.nature.sky, KEYWORDS.nature.plants, KEYWORDS.nature.related])) {
      autoTags.nature = true;
      autoTags.objects.push('outdoor');
      hasMatch = true;
    }

    // Check for person
    if (this.containsKeyword(filename, [KEYWORDS.person.people, KEYWORDS.person.relationships, KEYWORDS.person.events, KEYWORDS.person.related])) {
      autoTags.person_id = `person_0001`;
      autoTags.objects.push('portrait');
      hasMatch = true;
    }

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
