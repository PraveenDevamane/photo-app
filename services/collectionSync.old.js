/**
 * Collection Sync Service
 * Keeps Person, Pet, Nature, Vehicle collections in sync with Image data
 */

const Person = require('../models/Person');
const Pet = require('../models/Pet');
const Nature = require('../models/Nature');
const Vehicle = require('../models/Vehicle');

class CollectionSync {
  /**
   * Add image to appropriate category collection
   */
  static async addImageToCollection(image) {
    const { autoTags, _id, filename } = image;
    const imageUrl = `/uploads/${filename}`;

    try {
      // Person collection
      if (autoTags.person_id) {
        await Person.findOneAndUpdate(
          { personId: autoTags.person_id },
          {
            $addToSet: { images: _id },
            $inc: { 'metadata.imageCount': 1 },
            $set: { 
              'metadata.lastSeen': new Date(),
              sampleImageUrl: imageUrl
            },
            $setOnInsert: { 
              personId: autoTags.person_id,
              'metadata.firstSeen': new Date(),
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        console.log(`✅ Added image to Person collection: ${autoTags.person_id}`);
      }

      // Pet collection
      if (autoTags.pets) {
        await Pet.findOneAndUpdate(
          { category: 'pet' },
          {
            $addToSet: { images: _id },
            $inc: { 'metadata.imageCount': 1 },
            $set: { 
              updatedAt: new Date(),
              sampleImageUrl: imageUrl
            },
            $setOnInsert: { 
              category: 'pet',
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        console.log(`✅ Added image to Pet collection`);
      }

      // Nature collection
      if (autoTags.nature) {
        await Nature.findOneAndUpdate(
          { category: 'nature' },
          {
            $addToSet: { images: _id },
            $inc: { 'metadata.imageCount': 1 },
            $set: { 
              updatedAt: new Date(),
              sampleImageUrl: imageUrl
            },
            $setOnInsert: { 
              category: 'nature',
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        console.log(`✅ Added image to Nature collection`);
      }

      // Vehicle collection
      if (autoTags.vehicle) {
        await Vehicle.findOneAndUpdate(
          { category: 'vehicle' },
          {
            $addToSet: { images: _id },
            $inc: { 'metadata.imageCount': 1 },
            $set: { 
              updatedAt: new Date(),
              sampleImageUrl: imageUrl
            },
            $setOnInsert: { 
              category: 'vehicle',
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        console.log(`✅ Added image to Vehicle collection`);
      }
    } catch (error) {
      console.error('Error adding image to collection:', error);
    }
  }

  /**
   * Remove image from all category collections
   */
  static async removeImageFromCollections(image) {
    const { autoTags, _id } = image;

    try {
      // Remove from Person collection
      if (autoTags.person_id) {
        await Person.findOneAndUpdate(
          { personId: autoTags.person_id },
          {
            $pull: { images: _id },
            $inc: { 'metadata.imageCount': -1 }
          }
        );
        // Remove person doc if no images left
        await Person.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
        console.log(`🗑️ Removed image from Person collection: ${autoTags.person_id}`);
      }

      // Remove from Pet collection
      if (autoTags.pets) {
        await Pet.findOneAndUpdate(
          { category: 'pet' },
          {
            $pull: { images: _id },
            $inc: { 'metadata.imageCount': -1 }
          }
        );
        await Pet.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
        console.log(`🗑️ Removed image from Pet collection`);
      }

      // Remove from Nature collection
      if (autoTags.nature) {
        await Nature.findOneAndUpdate(
          { category: 'nature' },
          {
            $pull: { images: _id },
            $inc: { 'metadata.imageCount': -1 }
          }
        );
        await Nature.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
        console.log(`🗑️ Removed image from Nature collection`);
      }

      // Remove from Vehicle collection
      if (autoTags.vehicle) {
        await Vehicle.findOneAndUpdate(
          { category: 'vehicle' },
          {
            $pull: { images: _id },
            $inc: { 'metadata.imageCount': -1 }
          }
        );
        await Vehicle.deleteMany({ 'metadata.imageCount': { $lte: 0 } });
        console.log(`🗑️ Removed image from Vehicle collection`);
      }
    } catch (error) {
      console.error('Error removing image from collection:', error);
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
    } catch (error) {
      console.error('Error clearing collections:', error);
    }
  }

  /**
   * Get summary of all category collections
   */
  static async getCollectionsSummary() {
    try {
      const persons = await Person.find().populate('images', 'filename originalName');
      const pets = await Pet.find().populate('images', 'filename originalName');
      const nature = await Nature.find().populate('images', 'filename originalName');
      const vehicles = await Vehicle.find().populate('images', 'filename originalName');

      return {
        persons: persons.map(p => ({
          personId: p.personId,
          displayName: p.displayName,
          imageCount: p.metadata.imageCount,
          sampleImageUrl: p.sampleImageUrl,
          images: p.images.map(img => ({ id: img._id, filename: img.originalName }))
        })),
        pets: pets.map(p => ({
          category: p.category,
          imageCount: p.metadata.imageCount,
          sampleImageUrl: p.sampleImageUrl,
          images: p.images.map(img => ({ id: img._id, filename: img.originalName }))
        })),
        nature: nature.map(n => ({
          category: n.category,
          imageCount: n.metadata.imageCount,
          sampleImageUrl: n.sampleImageUrl,
          images: n.images.map(img => ({ id: img._id, filename: img.originalName }))
        })),
        vehicles: vehicles.map(v => ({
          category: v.category,
          imageCount: v.metadata.imageCount,
          sampleImageUrl: v.sampleImageUrl,
          images: v.images.map(img => ({ id: img._id, filename: img.originalName }))
        }))
      };
    } catch (error) {
      console.error('Error getting collections summary:', error);
      return { persons: [], pets: [], nature: [], vehicles: [] };
    }
  }
}

module.exports = CollectionSync;
