const tf = require('@tensorflow/tfjs-node');
const mobilenet = require('@tensorflow-models/mobilenet');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

let model = null;

// Category mappings from MobileNet labels to our categories
const categoryMappings = {
  person: [
    'person', 'man', 'woman', 'boy', 'girl', 'child', 'people', 'face',
    'jersey', 'suit', 'gown', 'dress', 'bikini', 'bathing_cap',
    'military_uniform', 'academic_gown', 'lab_coat', 'apron',
    'jean', 'miniskirt', 'overskirt', 'hoopskirt', 'poncho',
    'sweatshirt', 'cardigan', 'bulletproof_vest', 'brassiere',
    'running_shoe', 'loafer', 'clog', 'sandal', 'cowboy_boot'
  ],
  pet: [
    // Dogs
    'dog', 'puppy', 'hound', 'terrier', 'retriever', 'poodle', 'beagle',
    'labrador', 'collie', 'shepherd', 'bulldog', 'chihuahua', 'dalmatian',
    'husky', 'corgi', 'pug', 'boxer', 'doberman', 'rottweiler', 'mastiff',
    'great_dane', 'saint_bernard', 'golden_retriever', 'german_shepherd',
    'border_collie', 'cocker_spaniel', 'shih-tzu', 'maltese',
    'toy_poodle', 'miniature_poodle', 'standard_poodle',
    'tibetan_mastiff', 'french_bulldog', 'english_setter',
    'irish_setter', 'gordon_setter', 'brittany_spaniel',
    'clumber', 'springer_spaniel', 'welsh_springer_spaniel',
    'sussex_spaniel', 'irish_water_spaniel', 'vizsla', 'weimaraner',
    'chesapeake_bay_retriever', 'curly-coated_retriever', 'flat-coated_retriever',
    'afghan_hound', 'basset', 'bloodhound', 'bluetick', 'redbone',
    'walker_hound', 'english_foxhound', 'borzoi', 'irish_wolfhound',
    'scottish_deerhound', 'whippet', 'ibizan_hound', 'norwegian_elkhound',
    'otterhound', 'saluki', 'black-and-tan_coonhound',
    'american_staffordshire_terrier', 'staffordshire_bullterrier',
    'bedlington_terrier', 'border_terrier', 'kerry_blue_terrier',
    'irish_terrier', 'norfolk_terrier', 'norwich_terrier',
    'yorkshire_terrier', 'wire-haired_fox_terrier', 'lakeland_terrier',
    'sealyham_terrier', 'airedale', 'cairn', 'australian_terrier',
    'dandie_dinmont', 'boston_bull', 'miniature_schnauzer',
    'giant_schnauzer', 'standard_schnauzer', 'scotch_terrier',
    'tibetan_terrier', 'silky_terrier', 'soft-coated_wheaten_terrier',
    'west_highland_white_terrier', 'lhasa', 'eskimo_dog', 'malamute',
    'siberian_husky', 'affenpinscher', 'basenji', 'keeshond',
    'brabancon_griffon', 'pembroke', 'cardigan', 'toy_terrier',
    'miniature_pinscher', 'papillon', 'japanese_chin', 'pekinese', 'shih_tzu',
    // Cats
    'cat', 'kitten', 'tabby', 'siamese', 'persian', 'egyptian_cat',
    'tiger_cat', 'lynx', 'cougar', 'leopard', 'snow_leopard', 'jaguar',
    // Birds
    'bird', 'parrot', 'parakeet', 'cockatoo', 'macaw', 'budgerigar',
    'canary', 'finch', 'robin', 'jay', 'magpie', 'chickadee',
    // Fish & aquatic pets
    'goldfish', 'fish', 'aquarium',
    // Small pets
    'hamster', 'guinea_pig', 'rabbit', 'hare', 'mouse', 'rat',
    // Reptiles
    'turtle', 'tortoise', 'gecko', 'iguana', 'chameleon'
  ],
  nature: [
    // Landscapes
    'cliff', 'valley', 'mountain', 'volcano', 'lakeside', 'seashore',
    'beach', 'promontory', 'sandbar', 'coral_reef', 'geyser', 'alp',
    // Gardens & plants
    'garden', 'flower', 'rose', 'daisy', 'sunflower', 'tulip',
    'poppy', 'dandelion', 'orchid', 'lily', 'lotus', 'hibiscus',
    'petunia', 'pot', 'flowerpot', 'vase',
    // Trees & forests
    'tree', 'forest', 'jungle', 'rainforest', 'woodland',
    'oak', 'maple', 'pine', 'palm', 'willow', 'bamboo',
    // Sky & weather
    'sky', 'cloud', 'sunset', 'sunrise', 'rainbow',
    // Water bodies
    'lake', 'river', 'waterfall', 'fountain', 'pond', 'sea', 'ocean',
    'dam', 'pier', 'breakwater',
    // Nature objects
    'mushroom', 'coral', 'anemone', 'jellyfish', 'starfish',
    'sea_urchin', 'sea_cucumber', 'sea_slug',
    // Natural structures
    'rock', 'stone_wall', 'boathouse', 'dock', 'barn', 'greenhouse'
  ],
  vehicle: [
    // Cars
    'car', 'automobile', 'sedan', 'convertible', 'sports_car',
    'racer', 'race_car', 'minivan', 'cab', 'taxi', 'jeep', 'suv',
    'limousine', 'beach_wagon', 'station_wagon', 'pickup',
    'model_t', 'ambulance', 'moving_van', 'police_van',
    'fire_engine', 'garbage_truck', 'tow_truck',
    // Motorcycles
    'motorcycle', 'bike', 'motorbike', 'moped', 'scooter',
    // Trucks
    'truck', 'trailer_truck', 'tractor', 'semi',
    // Buses
    'bus', 'school_bus', 'trolleybus', 'minibus',
    // Other vehicles
    'van', 'recreational_vehicle', 'motor_scooter',
    // Aircraft
    'airplane', 'aircraft', 'airliner', 'warplane', 'jet',
    // Boats
    'boat', 'ship', 'yacht', 'speedboat', 'gondola', 'canoe', 'kayak',
    'catamaran', 'trimaran', 'lifeboat', 'fireboat', 'container_ship',
    'aircraft_carrier', 'submarine', 'pirate', 'liner',
    // Trains
    'train', 'locomotive', 'bullet_train', 'freight_car', 'passenger_car',
    'streetcar', 'electric_locomotive', 'steam_locomotive',
    // Bicycles
    'bicycle', 'mountain_bike', 'tricycle', 'unicycle',
    // Heavy equipment
    'crane', 'forklift', 'harvester', 'thresher', 'snowplow',
    'tank', 'half_track', 'amphibian'
  ]
};

// Initialize MobileNet model
async function initializeModel() {
  if (!model) {
    console.log('Loading MobileNet model...');
    model = await mobilenet.load({
      version: 2,
      alpha: 1.0
    });
    console.log('MobileNet model loaded successfully!');
  }
  return model;
}

// Preprocess image for MobileNet
async function preprocessImage(imagePath) {
  try {
    // Read and resize image to 224x224 (MobileNet input size)
    const imageBuffer = await sharp(imagePath)
      .resize(224, 224)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert to tensor
    const { data, info } = imageBuffer;
    const tensor = tf.tensor3d(data, [info.height, info.width, info.channels]);
    
    // Normalize to [0, 1]
    const normalized = tensor.div(255.0);
    
    // Add batch dimension
    const batched = normalized.expandDims(0);
    
    return batched;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    throw error;
  }
}

// Get predictions from MobileNet
async function classifyImage(imagePath) {
  try {
    await initializeModel();
    
    // Read the image
    const imageBuffer = await fs.promises.readFile(imagePath);
    const decodedImage = tf.node.decodeImage(imageBuffer, 3);
    
    // Get predictions
    const predictions = await model.classify(decodedImage);
    
    // Clean up tensor
    decodedImage.dispose();
    
    return predictions;
  } catch (error) {
    console.error('Error classifying image:', error);
    return [];
  }
}

// Map MobileNet predictions to our categories
function mapToCategories(predictions) {
  const detectedCategories = {
    person: { detected: false, confidence: 0, labels: [] },
    pet: { detected: false, confidence: 0, labels: [], petType: null },
    nature: { detected: false, confidence: 0, labels: [], sceneType: null },
    vehicle: { detected: false, confidence: 0, labels: [], vehicleType: null }
  };

  for (const prediction of predictions) {
    const label = prediction.className.toLowerCase().replace(/ /g, '_');
    const confidence = prediction.probability;

    // Check each category
    for (const [category, keywords] of Object.entries(categoryMappings)) {
      for (const keyword of keywords) {
        if (label.includes(keyword) || keyword.includes(label.split(',')[0].trim())) {
          if (confidence > detectedCategories[category].confidence) {
            detectedCategories[category].confidence = confidence;
            detectedCategories[category].detected = true;
            
            // Set specific types
            if (category === 'pet') {
              // Determine pet type
              if (label.match(/dog|puppy|hound|terrier|retriever|poodle|shepherd|bulldog|collie/i)) {
                detectedCategories[category].petType = 'dog';
              } else if (label.match(/cat|kitten|tabby|siamese|persian/i)) {
                detectedCategories[category].petType = 'cat';
              } else if (label.match(/bird|parrot|parakeet|cockatoo|macaw|canary/i)) {
                detectedCategories[category].petType = 'bird';
              } else if (label.match(/fish|goldfish|aquarium/i)) {
                detectedCategories[category].petType = 'fish';
              } else {
                detectedCategories[category].petType = 'other';
              }
            } else if (category === 'nature') {
              // Determine scene type
              if (label.match(/garden|flower|rose|tulip|daisy/i)) {
                detectedCategories[category].sceneType = 'garden';
              } else if (label.match(/beach|seashore|coast/i)) {
                detectedCategories[category].sceneType = 'beach';
              } else if (label.match(/mountain|cliff|alp|valley/i)) {
                detectedCategories[category].sceneType = 'mountain';
              } else if (label.match(/forest|tree|jungle|woodland/i)) {
                detectedCategories[category].sceneType = 'forest';
              } else if (label.match(/lake|river|waterfall|pond/i)) {
                detectedCategories[category].sceneType = 'water';
              } else {
                detectedCategories[category].sceneType = 'outdoor';
              }
            } else if (category === 'vehicle') {
              // Determine vehicle type
              if (label.match(/car|automobile|sedan|convertible|sports_car|taxi|jeep|suv|minivan/i)) {
                detectedCategories[category].vehicleType = 'car';
              } else if (label.match(/motorcycle|motorbike|bike|moped|scooter/i)) {
                detectedCategories[category].vehicleType = 'motorcycle';
              } else if (label.match(/truck|trailer|tractor|semi/i)) {
                detectedCategories[category].vehicleType = 'truck';
              } else if (label.match(/bus|trolley/i)) {
                detectedCategories[category].vehicleType = 'bus';
              } else if (label.match(/airplane|aircraft|airliner|jet/i)) {
                detectedCategories[category].vehicleType = 'aircraft';
              } else if (label.match(/boat|ship|yacht/i)) {
                detectedCategories[category].vehicleType = 'boat';
              } else if (label.match(/train|locomotive/i)) {
                detectedCategories[category].vehicleType = 'train';
              } else if (label.match(/bicycle|cycle/i)) {
                detectedCategories[category].vehicleType = 'bicycle';
              } else {
                detectedCategories[category].vehicleType = 'other';
              }
            }
          }
          detectedCategories[category].labels.push({
            label: prediction.className,
            confidence: confidence
          });
          break;
        }
      }
    }
  }

  return detectedCategories;
}

// Main function to analyze an image and return categories
async function analyzeImage(imagePath) {
  try {
    console.log(`Analyzing image: ${imagePath}`);
    
    // Get predictions from MobileNet
    const predictions = await classifyImage(imagePath);
    console.log('Raw predictions:', predictions);
    
    // Map to our categories
    const categories = mapToCategories(predictions);
    
    // Build result with all detected categories (for multi-tag support)
    const result = {
      predictions: predictions,
      categories: [],
      mlTags: predictions.map(p => ({
        label: p.className,
        confidence: p.probability
      }))
    };
    
    // Add all categories that were detected with confidence > 0.1
    const confidenceThreshold = 0.1;
    
    for (const [categoryName, categoryData] of Object.entries(categories)) {
      if (categoryData.detected && categoryData.confidence >= confidenceThreshold) {
        const categoryInfo = {
          category: categoryName,
          confidence: categoryData.confidence,
          labels: categoryData.labels
        };
        
        // Add specific type info
        if (categoryName === 'pet' && categoryData.petType) {
          categoryInfo.petType = categoryData.petType;
        } else if (categoryName === 'nature' && categoryData.sceneType) {
          categoryInfo.sceneType = categoryData.sceneType;
        } else if (categoryName === 'vehicle' && categoryData.vehicleType) {
          categoryInfo.vehicleType = categoryData.vehicleType;
        }
        
        result.categories.push(categoryInfo);
      }
    }
    
    // Sort by confidence
    result.categories.sort((a, b) => b.confidence - a.confidence);
    
    // If no categories detected, mark as uncategorized
    if (result.categories.length === 0) {
      result.categories.push({
        category: 'uncategorized',
        confidence: 1.0,
        labels: []
      });
    }
    
    console.log('Detected categories:', result.categories);
    return result;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return {
      predictions: [],
      categories: [{ category: 'uncategorized', confidence: 1.0, labels: [] }],
      mlTags: [],
      error: error.message
    };
  }
}

// Generate folder paths based on detected categories
function generateFolderPaths(analysisResult, personId = null) {
  const paths = [];
  
  for (const category of analysisResult.categories) {
    let folderPath;
    
    switch (category.category) {
      case 'person':
        if (personId) {
          folderPath = `organized/people/${personId}`;
        } else {
          folderPath = 'organized/people/unknown';
        }
        paths.push({ path: folderPath, category: 'person' });
        break;
        
      case 'pet':
        const petType = category.petType || 'other';
        folderPath = `organized/pets/${petType}`;
        paths.push({ path: folderPath, category: 'pet', petType });
        break;
        
      case 'nature':
        const sceneType = category.sceneType || 'outdoor';
        folderPath = `organized/nature/${sceneType}`;
        paths.push({ path: folderPath, category: 'nature', sceneType });
        break;
        
      case 'vehicle':
        const vehicleType = category.vehicleType || 'other';
        folderPath = `organized/vehicles/${vehicleType}`;
        paths.push({ path: folderPath, category: 'vehicle', vehicleType });
        break;
        
      default:
        folderPath = 'organized/uncategorized';
        paths.push({ path: folderPath, category: 'uncategorized' });
    }
  }
  
  // Always include uncategorized if no paths
  if (paths.length === 0) {
    paths.push({ path: 'organized/uncategorized', category: 'uncategorized' });
  }
  
  return paths;
}

module.exports = {
  initializeModel,
  classifyImage,
  analyzeImage,
  mapToCategories,
  generateFolderPaths,
  categoryMappings
};
