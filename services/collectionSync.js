const Person = require('../models/Person');
const Pet = require('../models/Pet');
const Nature = require('../models/Nature');
const Vehicle = require('../models/Vehicle');
const Uncategorized = require('../models/Uncategorized');

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
          {
            $push: { images: imageData },
            $inc: { 'metadata.imageCount': 1 },
            $set: { 'metadata.lastSeen': new Date(), sampleImageUrl: imageUrl },
            $setOnInsert: { personId: autoTags.person_id, 'metadata.firstSeen': new Date(), createdAt: new Date() }
          },
          { upsert: true, new: true }
        );
        results.addedTo.push('Person');
        addedToAny = true;
        console.log('Added to Person:', autoTags.person_id);
      }

      if (autoTags.pets) {
        await Pet.findOneAndUpdate(
          { category: 'pet' },
          {
            $push: { images: imageData },
            $inc: { 'metadata.imageCount': 1 },
            $set: { updatedAt: new Date(), sampleImageUrl: imageUrl },
            $setOnInsert: { category: 'pet', createdAt: new Date() }
          },
          { upsert: true, new: true }
        );
        results.addedTo.push('Pet');
        addedToAny = true;
        console.log('Added to Pet collection');
      }

      if (autoTags.nature) {
        await Nature.findOneAndUpdate(
          { category: 'nature' },
          {
            $push: { images: imageData },
            $inc: { 'metadata.imageCount': 1 },
            $set: { updatedAt: new Date(), sampleImageUrl: imageUrl },
            $setOnInsert: { category: 'nature', createdAt: new Date() }
          },
          { upsert: true, new: true }
        );
        results.addedTo.push('Nature');
        addedToAny = true;
        console.log('Added to Nature collection');
      }

      if (autoTags.vehicle) {
        await Vehicle.findOneAndUpdate(
          { category: 'vehicle' },
          {
            $push: { images: imageData },
            $inc: { 'metadata.imageCount': 1 },
            $set: { updatedAt: new Date(), sampleImageUrl: imageUrl },
            $setOnInsert: { category: 'vehicle', createdAt: new Date() }
          },
          { upsert: true, new: true }
        );
        results.addedTo.push('Vehicle');
        addedToAny = true;
        console.log('Added to Vehicle collection');
      }
      
      if (!addedToAny) {
        await Uncategorized.findOneAndUpdate(
          { category: 'uncategorized' },
          {
            $push: { images: imageData },
            $inc: { 'metadata.imageCount': 1 },
            $set: { updatedAt: new Date(), sampleImageUrl: imageUrl },
            $setOnInsert: { category: 'uncategorized', createdAt: new Date() }
          },
          { upsert: true, new: true }
        );
        results.addedTo.push('Uncategorized');
        console.log('Added to Uncategorized collection');
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
      await Uncategorized.updateMany({}, { $pull: { images: { filename } }, $inc: { 'metadata.imageCount': -1 } });
      
      await Person.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Pet.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Nature.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Vehicle.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Uncategorized.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      
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

    const uncategorized = await Uncategorized.find();
    for (const uncat of uncategorized) {
      for (const image of uncat.images || []) {
        if (!seenFilenames.has(image.filename)) {
          seenFilenames.add(image.filename);
          allImages.push({ ...image.toObject(), categories: ['uncategorized'] });
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

    const uncategorized = await Uncategorized.findOne({ 'images.filename': filename });
    if (uncategorized) {
      const image = uncategorized.images.find(i => i.filename === filename);
      if (image) return { ...image.toObject(), collection: 'Uncategorized' };
    }

    return null;
  }

  static async updateImageOrganizedStatus(filename, organized, organizedPaths) {
    await Person.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Pet.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Nature.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Vehicle.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
    await Uncategorized.updateMany({ 'images.filename': filename }, { $set: { 'images.$.organized': organized, 'images.$.organizedPaths': organizedPaths } });
  }

  static async getCollectionsSummary() {
    const persons = await Person.find();
    const pets = await Pet.find();
    const nature = await Nature.find();
    const vehicles = await Vehicle.find();
    const uncategorized = await Uncategorized.find();

    return {
      persons: persons.map(p => ({ personId: p.personId, images: p.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: p.metadata })),
      pets: pets.map(p => ({ category: p.category, images: p.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: p.metadata })),
      nature: nature.map(n => ({ category: n.category, images: n.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: n.metadata })),
      vehicles: vehicles.map(v => ({ category: v.category, images: v.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: v.metadata })),
      uncategorized: uncategorized.map(u => ({ category: u.category, images: u.images.map(i => ({ filename: i.filename, originalName: i.originalName, uploadedAt: i.uploadedAt, organized: i.organized })), metadata: u.metadata }))
    };
  }

  static async clearAllCollections() {
    await Person.deleteMany({});
    await Pet.deleteMany({});
    await Nature.deleteMany({});
    await Vehicle.deleteMany({});
    await Uncategorized.deleteMany({});
    console.log('Cleared all collections');
  }

  static async searchImagesByTags(searchTerms) {
    const results = [];
    const seenFilenames = new Set();

    // Always search ALL images by their tags
    const allImages = await this.getAllImages();
    
    for (const image of allImages) {
      const imageTags = Array.isArray(image.tags) ? image.tags : [];
      
      for (const term of searchTerms) {
        const regex = new RegExp(term, 'i');
        
        // Search in tags, originalName, filename, and categories
        const matchesTags = imageTags.some(t => regex.test(t));
        const matchesName = regex.test(image.originalName || '');
        const matchesFilename = regex.test(image.filename || '');
        const matchesCategory = (image.categories || []).some(c => regex.test(c));
        
        if (matchesTags || matchesName || matchesFilename || matchesCategory) {
          if (!seenFilenames.has(image.filename)) {
            seenFilenames.add(image.filename);
            results.push(image);
          }
          break;
        }
      }
    }

    return results;
  }
}

module.exports = CollectionSync;
