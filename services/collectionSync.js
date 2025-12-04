const Person = require('../models/Person');
const Pet = require('../models/Pet');
const Nature = require('../models/Nature');
const Vehicle = require('../models/Vehicle');

class CollectionSync {
  static async addImageToCollections(imageData) {
    const { autoTags, filename } = imageData;
    const imageUrl = '/uploads/' + filename;
    const results = { addedTo: [], errors: [] };
    let addedToAny = false;

    try {
      if (autoTags.person_id) {
        await Person.findOneAndUpdate(
          { personId: autoTags.person_id },
          { $push: { images: imageData }, $inc: { 'metadata.imageCount': 1 }, $set: { 'metadata.lastSeen': new Date(), sampleImageUrl: imageUrl }, $setOnInsert: { personId: autoTags.person_id, 'metadata.firstSeen': new Date(), createdAt: new Date() } },
          { upsert: true, new: true }
        );
        results.addedTo.push('Person');
        addedToAny = true;
        console.log('Added to Person:', autoTags.person_id);
      }

      if (autoTags.pets) {
        await Pet.findOneAndUpdate(
          { category: 'pet' },
          { $push: { images: imageData }, $inc: { 'metadata.imageCount': 1 }, $set: { updatedAt: new Date(), sampleImageUrl: imageUrl }, $setOnInsert: { category: 'pet', createdAt: new Date() } },
          { upsert: true, new: true }
        );
        results.addedTo.push('Pet');
        addedToAny = true;
        console.log('Added to Pet collection');
      }

      if (autoTags.nature) {
        await Nature.findOneAndUpdate(
          { category: 'nature' },
          { $push: { images: imageData }, $inc: { 'metadata.imageCount': 1 }, $set: { updatedAt: new Date(), sampleImageUrl: imageUrl }, $setOnInsert: { category: 'nature', createdAt: new Date() } },
          { upsert: true, new: true }
        );
        results.addedTo.push('Nature');
        addedToAny = true;
        console.log('Added to Nature collection');
      }

      if (autoTags.vehicle) {
        await Vehicle.findOneAndUpdate(
          { category: 'vehicle' },
          { $push: { images: imageData }, $inc: { 'metadata.imageCount': 1 }, $set: { updatedAt: new Date(), sampleImageUrl: imageUrl }, $setOnInsert: { category: 'vehicle', createdAt: new Date() } },
          { upsert: true, new: true }
        );
        results.addedTo.push('Vehicle');
        addedToAny = true;
        console.log('Added to Vehicle collection');
      }
      
      if (!addedToAny) {
        await Nature.findOneAndUpdate(
          { category: 'uncategorized' },
          { $push: { images: imageData }, $inc: { 'metadata.imageCount': 1 }, $set: { updatedAt: new Date(), sampleImageUrl: imageUrl }, $setOnInsert: { category: 'uncategorized', createdAt: new Date() } },
          { upsert: true, new: true }
        );
        results.addedTo.push('Nature (uncategorized)');
        console.log('Added to Nature as uncategorized');
      }
      
      return results;
    } catch (error) {
      console.error('Error adding image to collections:', error);
      results.errors.push({ general: error.message });
      return results;
    }
  }

  static async removeImageFromCollections(filename) {
    try {
      await Person.updateMany({}, { $pull: { images: { filename } }, $inc: { 'metadata.imageCount': -1 } });
      await Pet.updateMany({}, { $pull: { images: { filename } }, $inc: { 'metadata.imageCount': -1 } });
      await Nature.updateMany({}, { $pull: { images: { filename } }, $inc: { 'metadata.imageCount': -1 } });
      await Vehicle.updateMany({}, { $pull: { images: { filename } }, $inc: { 'metadata.imageCount': -1 } });
      await Person.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Pet.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Nature.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Vehicle.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      console.log('Removed image from all collections:', filename);
      return { success: true };
    } catch (error) {
      console.error('Error removing image from collections:', error);
      return { success: false, error: error.message };
    }
  }

  static async getAllImages() {
    const allImages = [];
    const seenFilenames = new Set();

    const persons = await Person.find();
    for (const person of persons) {
      for (const image of person.images || []) {
        if (!seenFilenames.has(image.filename)) {
          seenFilenames.add(image.filename);
          allImages.push({ ...image.toObject(), personId: person.personId, categories: ['person'] });
        }
      }
    }

    const pets = await Pet.find();
    for (const pet of pets) {
      for (const image of pet.images || []) {
        if (!seenFilenames.has(image.filename)) {
          seenFilenames.add(image.filename);
          allImages.push({ ...image.toObject(), categories: ['pet'] });
        }
      }
    }

    const nature = await Nature.find();
    for (const nat of nature) {
      for (const image of nat.images || []) {
        if (!seenFilenames.has(image.filename)) {
          seenFilenames.add(image.filename);
          allImages.push({ ...image.toObject(), categories: [nat.category === 'uncategorized' ? 'uncategorized' : 'nature'] });
        }
      }
    }

    const vehicles = await Vehicle.find();
    for (const vehicle of vehicles) {
      for (const image of vehicle.images || []) {
        if (!seenFilenames.has(image.filename)) {
          seenFilenames.add(image.filename);
          allImages.push({ ...image.toObject(), categories: ['vehicle'] });
        }
      }
    }

    return allImages;
  }

  static async findImageByFilename(filename) {
    const person = await Person.findOne({ 'images.filename': filename });
    if (person) {
      const image = person.images.find(i => i.filename === filename);
      if (image) return { ...image.toObject(), collection: 'Person', personId: person.personId };
    }

    const pet = await Pet.findOne({ 'images.filename': filename });
    if (pet) {
      const image = pet.images.find(i => i.filename === filename);
      if (image) return { ...image.toObject(), collection: 'Pet' };
    }

    const nature = await Nature.findOne({ 'images.filename': filename });
    if (nature) {
      const image = nature.images.find(i => i.filename === filename);
      if (image) return { ...image.toObject(), collection: 'Nature', category: nature.category };
    }

    const vehicle = await Vehicle.findOne({ 'images.filename': filename });
    if (vehicle) {
      const image = vehicle.images.find(i => i.filename === filename);
      if (image) return { ...image.toObject(), collection: 'Vehicle' };
    }

    return null;
  }

  static async updateImageOrganizedStatus(filename, organized, organizedPaths) {
    await Person.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Pet.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Nature.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Vehicle.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
  }

  static async getCollectionsSummary() {
    const persons = await Person.find();
    const pets = await Pet.find();
    const nature = await Nature.find();
    const vehicles = await Vehicle.find();

    return {
      persons: persons.map(p => ({ personId: p.personId, images: p.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: p.metadata })),
      pets: pets.map(p => ({ category: p.category, images: p.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: p.metadata })),
      nature: nature.map(n => ({ category: n.category, images: n.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: n.metadata })),
      vehicles: vehicles.map(v => ({ category: v.category, images: v.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: v.metadata }))
    };
  }

  static async clearAllCollections() {
    await Person.deleteMany({});
    await Pet.deleteMany({});
    await Nature.deleteMany({});
    await Vehicle.deleteMany({});
    console.log('Cleared all category collections');
  }

  // Optimized search - queries MongoDB directly with $regex
  static async searchImagesByTags(searchTerms) {
    const results = [];
    const seenFilenames = new Set();

    // Category keyword mapping for smart search
    const categoryKeywords = {
      person: ['person', 'people', 'human', 'face', 'portrait', 'selfie', 'family'],
      pet: ['pet', 'dog', 'cat', 'animal', 'puppy', 'kitten'],
      nature: ['nature', 'landscape', 'outdoor', 'flower', 'tree', 'mountain', 'beach', 'sunset', 'lake', 'river', 'forest'],
      vehicle: ['vehicle', 'car', 'bike', 'truck', 'motorcycle', 'bus', 'train', 'mercedes', 'bmw', 'toyota']
    };

    // Check if search terms match category keywords
    const matchesCategory = (category) => {
      return searchTerms.some(term => 
        categoryKeywords[category].some(keyword => 
          keyword.includes(term.toLowerCase()) || term.toLowerCase().includes(keyword)
        )
      );
    };

    // Helper function to check if an image matches search terms
    const imageMatchesSearch = (image, categoryMatch) => {
      // If category keyword matches, include all images from that collection
      if (categoryMatch) return true;
      
      // Check custom tags
      const tags = Array.isArray(image.tags) ? image.tags : [];
      for (const term of searchTerms) {
        const regex = new RegExp(term, 'i');
        if (tags.some(t => regex.test(t))) return true;
        if (regex.test(image.originalName || '')) return true;
        if (regex.test(image.filename || '')) return true;
        
        // Check autoTags object
        if (image.autoTags) {
          if (typeof image.autoTags === 'object') {
            // Check if autoTags has matching properties
            if (image.autoTags.nature && term.toLowerCase().includes('nature')) return true;
            if (image.autoTags.pets && (term.toLowerCase().includes('pet') || term.toLowerCase().includes('animal'))) return true;
            if (image.autoTags.vehicle && term.toLowerCase().includes('vehicle')) return true;
            if (image.autoTags.person_id && term.toLowerCase().includes('person')) return true;
            // Check objects array in autoTags
            if (Array.isArray(image.autoTags.objects)) {
              if (image.autoTags.objects.some(obj => regex.test(obj))) return true;
            }
          }
        }
      }
      return false;
    };

    // Search Person collection
    if (matchesCategory('person')) {
      try {
        const persons = await Person.find();
        for (const person of persons) {
          for (const image of person.images || []) {
            if (!seenFilenames.has(image.filename)) {
              seenFilenames.add(image.filename);
              results.push({ ...image.toObject(), personId: person.personId, categories: ['person'] });
            }
          }
        }
      } catch (err) {
        console.error('Error searching Person collection:', err.message);
      }
    }

    // Search Pet collection
    if (matchesCategory('pet')) {
      try {
        const pets = await Pet.find();
        for (const pet of pets) {
          for (const image of pet.images || []) {
            if (!seenFilenames.has(image.filename)) {
              seenFilenames.add(image.filename);
              results.push({ ...image.toObject(), categories: ['pet'] });
            }
          }
        }
      } catch (err) {
        console.error('Error searching Pet collection:', err.message);
      }
    }

    // Search Nature collection
    if (matchesCategory('nature')) {
      try {
        const nature = await Nature.find();
        for (const nat of nature) {
          for (const image of nat.images || []) {
            if (!seenFilenames.has(image.filename)) {
              seenFilenames.add(image.filename);
              results.push({ ...image.toObject(), categories: [nat.category === 'uncategorized' ? 'uncategorized' : 'nature'] });
            }
          }
        }
      } catch (err) {
        console.error('Error searching Nature collection:', err.message);
      }
    }

    // Search Vehicle collection
    if (matchesCategory('vehicle')) {
      try {
        const vehicles = await Vehicle.find();
        for (const vehicle of vehicles) {
          for (const image of vehicle.images || []) {
            if (!seenFilenames.has(image.filename)) {
              seenFilenames.add(image.filename);
              results.push({ ...image.toObject(), categories: ['vehicle'] });
            }
          }
        }
      } catch (err) {
        console.error('Error searching Vehicle collection:', err.message);
      }
    }

    // If no category matched, do a general search across all collections
    if (!matchesCategory('person') && !matchesCategory('pet') && !matchesCategory('nature') && !matchesCategory('vehicle')) {
      // Search all collections for filename/tag matches
      const allImages = await this.getAllImages();
      for (const image of allImages) {
        if (!seenFilenames.has(image.filename) && imageMatchesSearch(image, false)) {
          seenFilenames.add(image.filename);
          results.push(image);
        }
      }
    }

    return results;
  }
}

module.exports = CollectionSync;
