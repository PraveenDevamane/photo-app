const mongoose = require('mongoose');

// Embedded image schema - stores full image data
const imageDataSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  filepath: { type: String, required: true },
  mimetype: { type: String },
  size: { type: Number },
  embedding: [{ type: Number }],
  tags: [{ type: String }],
  autoTags: {
    person_id: { type: String, default: null },
    nature: { type: Boolean, default: false },
    pets: { type: Boolean, default: false },
    vehicle: { type: Boolean, default: false },
    objects: [{ type: String }]
  },
  organized: { type: Boolean, default: false },
  organizedPaths: [{ type: String }],
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const petSchema = new mongoose.Schema({
  category: { type: String, default: 'pet' },
  images: [imageDataSchema],
  sampleImageUrl: { type: String, default: null },
  metadata: {
    imageCount: { type: Number, default: 0 },
    keywords: [{ type: String }]
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pet', petSchema);
