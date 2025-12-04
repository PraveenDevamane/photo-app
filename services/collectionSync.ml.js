/**
 * Collection Sync Service - Updated
 * Stores full image data in Person, Pet, Nature, Vehicle collections
 * No dependency on Images collection - data is stored directly in category collections
 */

const Person = require('../models/Person');
const Pet = require('../models/Pet');
const Nature = require('../models/Nature');
const Vehicle = require('../models/Vehicle');

class CollectionSync {
  /**
   * Add full image data to appropriate category collection(s)
   * Supports multi-category: image can be in multiple collections
   * @param {Object} imageData - Full image data object
   * @param {Array} categories - Array of category info from ML tagger
   * @param {String} personId - Optional person ID for person categorization
   */
  static async addImageToCollections(imageData, categories, personId = null) {
    const results = {
      addedTo: [],
      errors: []
    };

    try {
      for (const categoryInfo of categories) {
        const category = categoryInfo.category;
        
        switch (category) {
          case 'person':
            const pId = personId || 'unknown';
            const personResult = await this.addToPerson(imageData, pId);
            if (personResult.success) {
              results.addedTo.push({ collection: 'Person', personId: pId });
            } else {
              results.errors.push({ collection: 'Person', error: personResult.error });
            }
            break;

          case 'pet':
            const petType = categoryInfo.petType || 'other';
            const petResult = await this.addToPet(imageData, petType);
            if (petResult.success) {
              results.addedTo.push({ collection: 'Pet', petType });
            } else {
              results.errors.push({ collection: 'Pet', error: petResult.error });
            }
            break;

          case 'nature':
            const sceneType = categoryInfo.sceneType || 'outdoor';
            const natureResult = await this.addToNature(imageData, sceneType);
            if (natureResult.success) {
              results.addedTo.push({ collection: 'Nature', sceneType });
            } else {
              results.errors.push({ collection: 'Nature', error: natureResult.error });
            }
            break;

          case 'vehicle':
            const vehicleType = categoryInfo.vehicleType || 'other';
            const vehicleResult = await this.addToVehicle(imageData, vehicleType);
            if (vehicleResult.success) {
              results.addedTo.push({ collection: 'Vehicle', vehicleType });
            } else {
              results.errors.push({ collection: 'Vehicle', error: vehicleResult.error });
            }
            break;
        }
      }

      console.log(`✅ Image added to collections:`, results.addedTo.map(r => r.collection).join(', '));
      return results;
    } catch (error) {
      console.error('Error adding image to collections:', error);
      results.errors.push({ general: error.message });
      return results;
    }
  }

  /**
   * Add image to Person collection
   */
  static async addToPerson(imageData, personId) {
    try {
      const imageEntry = {
        filename: imageData.filename,
        originalName: imageData.originalName,
        filepath: imageData.filepath,
        mimetype: imageData.mimetype,
        size: imageData.size,
        embedding: imageData.embedding || [],
        tags: imageData.tags || [],
        mlTags: imageData.mlTags || [],
        organized: imageData.organized || false,
        organizedPaths: imageData.organizedPaths || [],
        uploadedAt: imageData.uploadedAt || new Date()
      };

      const imageUrl = `/uploads/${imageData.filename}`;

      await Person.findOneAndUpdate(
        { personId: personId },
        {
          $push: { images: imageEntry },
          $inc: { 'metadata.imageCount': 1 },
          $set: { 
            'metadata.lastSeen': new Date(),
            sampleImageUrl: imageUrl
          },
          $setOnInsert: { 
            personId: personId,
            'metadata.firstSeen': new Date(),
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding to Person collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add image to Pet collection
   */
  static async addToPet(imageData, petType) {
    try {
      const imageEntry = {
        filename: imageData.filename,
        originalName: imageData.originalName,
        filepath: imageData.filepath,
        mimetype: imageData.mimetype,
        size: imageData.size,
        embedding: imageData.embedding || [],
        tags: imageData.tags || [],
        mlTags: imageData.mlTags || [],
        petType: petType,
        organized: imageData.organized || false,
        organizedPaths: imageData.organizedPaths || [],
        uploadedAt: imageData.uploadedAt || new Date()
      };

      const imageUrl = `/uploads/${imageData.filename}`;

      await Pet.findOneAndUpdate(
        { petType: petType },
        {
          $push: { images: imageEntry },
          $inc: { 'metadata.imageCount': 1 },
          $set: { 
            updatedAt: new Date(),
            sampleImageUrl: imageUrl,
            category: 'pet'
          },
          $setOnInsert: { 
            petType: petType,
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding to Pet collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add image to Nature collection
   */
  static async addToNature(imageData, sceneType) {
    try {
      const imageEntry = {
        filename: imageData.filename,
        originalName: imageData.originalName,
        filepath: imageData.filepath,
        mimetype: imageData.mimetype,
        size: imageData.size,
        embedding: imageData.embedding || [],
        tags: imageData.tags || [],
        mlTags: imageData.mlTags || [],
        sceneType: sceneType,
        organized: imageData.organized || false,
        organizedPaths: imageData.organizedPaths || [],
        uploadedAt: imageData.uploadedAt || new Date()
      };

      const imageUrl = `/uploads/${imageData.filename}`;

      await Nature.findOneAndUpdate(
        { sceneType: sceneType },
        {
          $push: { images: imageEntry },
          $inc: { 'metadata.imageCount': 1 },
          $set: { 
            updatedAt: new Date(),
            sampleImageUrl: imageUrl,
            category: 'nature'
          },
          $setOnInsert: { 
            sceneType: sceneType,
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding to Nature collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add image to Vehicle collection
   */
  static async addToVehicle(imageData, vehicleType) {
    try {
      const imageEntry = {
        filename: imageData.filename,
        originalName: imageData.originalName,
        filepath: imageData.filepath,
        mimetype: imageData.mimetype,
        size: imageData.size,
        embedding: imageData.embedding || [],
        tags: imageData.tags || [],
        mlTags: imageData.mlTags || [],
        vehicleType: vehicleType,
        organized: imageData.organized || false,
        organizedPaths: imageData.organizedPaths || [],
        uploadedAt: imageData.uploadedAt || new Date()
      };

      const imageUrl = `/uploads/${imageData.filename}`;

      await Vehicle.findOneAndUpdate(
        { vehicleType: vehicleType },
        {
          $push: { images: imageEntry },
          $inc: { 'metadata.imageCount': 1 },
          $set: { 
            updatedAt: new Date(),
            sampleImageUrl: imageUrl,
            category: 'vehicle'
          },
          $setOnInsert: { 
            vehicleType: vehicleType,
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding to Vehicle collection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove image from all collections by filename
   */
  static async removeImageFromCollections(filename) {
    try {
      // Remove from all collections where this image exists
      await Person.updateMany(
        {},
        { 
          $pull: { images: { filename: filename } },
          $inc: { 'metadata.imageCount': -1 }
        }
      );
      
      await Pet.updateMany(
        {},
        { 
          $pull: { images: { filename: filename } },
          $inc: { 'metadata.imageCount': -1 }
        }
      );
      
      await Nature.updateMany(
        {},
        { 
          $pull: { images: { filename: filename } },
          $inc: { 'metadata.imageCount': -1 }
        }
      );
      
      await Vehicle.updateMany(
        {},
        { 
          $pull: { images: { filename: filename } },
          $inc: { 'metadata.imageCount': -1 }
        }
      );

      // Clean up empty documents
      await Person.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Pet.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Nature.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
      await Vehicle.deleteMany({ 'metadata.imageCount': { $lte: 0 } });

      console.log(`🗑️ Removed image from all collections: ${filename}`);
      return { success: true };
    } catch (error) {
      console.error('Error removing image from collections:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update image organization status in all collections
   */
  static async updateImageOrganizedStatus(filename, organized, organizedPaths) {
    try {
      await Person.updateMany(
        { 'images.filename': filename },
        { 
          $set: { 
            'images.$.organized': organized,
            'images.$.organizedPaths': organizedPaths
          }
        }
      );
      
      await Pet.updateMany(
        { 'images.filename': filename },
        { 
          $set: { 
            'images.$.organized': organized,
            'images.$.organizedPaths': organizedPaths
          }
        }
      );
      
      await Nature.updateMany(
        { 'images.filename': filename },
        { 
          $set: { 
            'images.$.organized': organized,
            'images.$.organizedPaths': organizedPaths
          }
        }
      );
      
      await Vehicle.updateMany(
        { 'images.filename': filename },
        { 
          $set: { 
            'images.$.organized': organized,
            'images.$.organizedPaths': organizedPaths
          }
        }
      );

      console.log(`📁 Updated organization status for: ${filename}`);
      return { success: true };
    } catch (error) {
      console.error('Error updating organization status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all category collections (used during reprocess/reorganize)
   */
  static async clearAllCollections() {
    try {
      await Person.deleteMany({});
      await Pet.deleteMany({});
      await Nature.deleteMany({});
      await Vehicle.deleteMany({});
      console.log('🧹 Cleared all category collections');
      return { success: true };
    } catch (error) {
      console.error('Error clearing collections:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all images from all collections (for gallery view)
   */
  static async getAllImages() {
    try {
      const allImages = [];
      const seenFilenames = new Set();

      // Gather from all collections
      const persons = await Person.find();
      const pets = await Pet.find();
      const nature = await Nature.find();
      const vehicles = await Vehicle.find();

      // Add person images
      for (const person of persons) {
        for (const img of person.images) {
          if (!seenFilenames.has(img.filename)) {
            seenFilenames.add(img.filename);
            allImages.push({
              ...img.toObject(),
              _id: img._id,
              categories: ['person'],
              personId: person.personId
            });
          } else {
            // Update categories for existing entry
            const existing = allImages.find(i => i.filename === img.filename);
            if (existing && !existing.categories.includes('person')) {
              existing.categories.push('person');
              existing.personId = person.personId;
            }
          }
        }
      }

      // Add pet images
      for (const pet of pets) {
        for (const img of pet.images) {
          if (!seenFilenames.has(img.filename)) {
            seenFilenames.add(img.filename);
            allImages.push({
              ...img.toObject(),
              _id: img._id,
              categories: ['pet'],
              petType: pet.petType
            });
          } else {
            const existing = allImages.find(i => i.filename === img.filename);
            if (existing && !existing.categories.includes('pet')) {
              existing.categories.push('pet');
              existing.petType = pet.petType;
            }
          }
        }
      }

      // Add nature images
      for (const natureDoc of nature) {
        for (const img of natureDoc.images) {
          if (!seenFilenames.has(img.filename)) {
            seenFilenames.add(img.filename);
            allImages.push({
              ...img.toObject(),
              _id: img._id,
              categories: ['nature'],
              sceneType: natureDoc.sceneType
            });
          } else {
            const existing = allImages.find(i => i.filename === img.filename);
            if (existing && !existing.categories.includes('nature')) {
              existing.categories.push('nature');
              existing.sceneType = natureDoc.sceneType;
            }
          }
        }
      }

      // Add vehicle images
      for (const vehicle of vehicles) {
        for (const img of vehicle.images) {
          if (!seenFilenames.has(img.filename)) {
            seenFilenames.add(img.filename);
            allImages.push({
              ...img.toObject(),
              _id: img._id,
              categories: ['vehicle'],
              vehicleType: vehicle.vehicleType
            });
          } else {
            const existing = allImages.find(i => i.filename === img.filename);
            if (existing && !existing.categories.includes('vehicle')) {
              existing.categories.push('vehicle');
              existing.vehicleType = vehicle.vehicleType;
            }
          }
        }
      }

      return allImages;
    } catch (error) {
      console.error('Error getting all images:', error);
      return [];
    }
  }

  /**
   * Get summary of all category collections
   */
  static async getCollectionsSummary() {
    try {
      const persons = await Person.find();
      const pets = await Pet.find();
      const nature = await Nature.find();
      const vehicles = await Vehicle.find();

      return {
        persons: persons.map(p => ({
          personId: p.personId,
          displayName: p.displayName,
          imageCount: p.metadata.imageCount,
          sampleImageUrl: p.sampleImageUrl,
          images: p.images.map(img => ({ 
            _id: img._id,
            filename: img.filename,
            originalName: img.originalName,
            mlTags: img.mlTags,
            organized: img.organized
          }))
        })),
        pets: pets.map(p => ({
          category: p.category,
          petType: p.petType,
          imageCount: p.metadata.imageCount,
          sampleImageUrl: p.sampleImageUrl,
          images: p.images.map(img => ({ 
            _id: img._id,
            filename: img.filename,
            originalName: img.originalName,
            petType: img.petType,
            mlTags: img.mlTags,
            organized: img.organized
          }))
        })),
        nature: nature.map(n => ({
          category: n.category,
          sceneType: n.sceneType,
          imageCount: n.metadata.imageCount,
          sampleImageUrl: n.sampleImageUrl,
          images: n.images.map(img => ({ 
            _id: img._id,
            filename: img.filename,
            originalName: img.originalName,
            sceneType: img.sceneType,
            mlTags: img.mlTags,
            organized: img.organized
          }))
        })),
        vehicles: vehicles.map(v => ({
          category: v.category,
          vehicleType: v.vehicleType,
          imageCount: v.metadata.imageCount,
          sampleImageUrl: v.sampleImageUrl,
          images: v.images.map(img => ({ 
            _id: img._id,
            filename: img.filename,
            originalName: img.originalName,
            vehicleType: img.vehicleType,
            mlTags: img.mlTags,
            organized: img.organized
          }))
        }))
      };
    } catch (error) {
      console.error('Error getting collections summary:', error);
      return { persons: [], pets: [], nature: [], vehicles: [] };
    }
  }

  /**
   * Find image by filename across all collections
   */
  static async findImageByFilename(filename) {
    try {
      // Search in all collections
      let person = await Person.findOne({ 'images.filename': filename });
      if (person) {
        const img = person.images.find(i => i.filename === filename);
        return { ...img.toObject(), collection: 'Person', personId: person.personId };
      }

      let pet = await Pet.findOne({ 'images.filename': filename });
      if (pet) {
        const img = pet.images.find(i => i.filename === filename);
        return { ...img.toObject(), collection: 'Pet', petType: pet.petType };
      }

      let natureDoc = await Nature.findOne({ 'images.filename': filename });
      if (natureDoc) {
        const img = natureDoc.images.find(i => i.filename === filename);
        return { ...img.toObject(), collection: 'Nature', sceneType: natureDoc.sceneType };
      }

      let vehicle = await Vehicle.findOne({ 'images.filename': filename });
      if (vehicle) {
        const img = vehicle.images.find(i => i.filename === filename);
        return { ...img.toObject(), collection: 'Vehicle', vehicleType: vehicle.vehicleType };
      }

      return null;
    } catch (error) {
      console.error('Error finding image by filename:', error);
      return null;
    }
  }
}

module.exports = CollectionSync;
