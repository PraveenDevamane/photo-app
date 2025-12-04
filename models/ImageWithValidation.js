/**
 * ============================================
 * MONGODB ASSERTIONS & TRIGGERS DEMONSTRATION
 * ============================================
 * 
 * This file demonstrates:
 * 1. ASSERTIONS (Schema Validation) - Rules that validate data before saving
 * 2. TRIGGERS (Mongoose Middleware) - Pre/Post hooks that run on CRUD operations
 */

const mongoose = require('mongoose');

// ============================================
// PART 1: ASSERTIONS (Schema Validation Rules)
// ============================================

/**
 * ASSERTIONS are validation rules that:
 * - Run BEFORE data is inserted/updated
 * - Reject invalid data with error messages
 * - Ensure data integrity in the database
 */

const imageValidationSchema = new mongoose.Schema({
  // ASSERTION 1: Required field validation
  filename: { 
    type: String, 
    required: [true, 'Filename is required - ASSERTION FAILED'],
    trim: true
  },
  
  originalName: { 
    type: String, 
    required: [true, 'Original name is required - ASSERTION FAILED']
  },
  
  // ASSERTION 2: Enum validation - value must be one of these
  mimetype: { 
    type: String,
    enum: {
      values: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'],
      message: 'ASSERTION FAILED: {VALUE} is not a valid image type. Must be jpeg, png, gif, or webp'
    }
  },
  
  // ASSERTION 3: Min/Max validation for numbers
  size: { 
    type: Number,
    min: [1, 'ASSERTION FAILED: File size must be at least 1 byte'],
    max: [50 * 1024 * 1024, 'ASSERTION FAILED: File size cannot exceed 50MB']
  },
  
  // ASSERTION 4: Custom validator function
  tags: {
    type: [String],
    validate: {
      validator: function(tags) {
        // Each tag must be between 1-50 characters
        return tags.every(tag => tag.length >= 1 && tag.length <= 50);
      },
      message: 'ASSERTION FAILED: Each tag must be between 1-50 characters'
    }
  },
  
  // ASSERTION 5: String length validation with regex
  category: {
    type: String,
    match: [/^[a-zA-Z0-9_-]+$/, 'ASSERTION FAILED: Category can only contain letters, numbers, underscores, and hyphens']
  },
  
  // ASSERTION 6: URL format validation
  imageUrl: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^\/uploads\//.test(v) || /^https?:\/\//.test(v);
      },
      message: 'ASSERTION FAILED: Image URL must start with /uploads/ or http(s)://'
    }
  },
  
  // Metadata with nested assertions
  metadata: {
    width: { 
      type: Number, 
      min: [1, 'ASSERTION FAILED: Width must be positive'] 
    },
    height: { 
      type: Number, 
      min: [1, 'ASSERTION FAILED: Height must be positive'] 
    },
    uploadedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  
  // Audit trail
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 }
});


// ============================================
// PART 2: TRIGGERS (Mongoose Middleware/Hooks)
// ============================================

/**
 * TRIGGERS are functions that:
 * - Run automatically on database events
 * - Can modify data before saving (pre-hooks)
 * - Can perform actions after operations (post-hooks)
 * - Useful for logging, validation, cascading updates
 */

// ------------------------------------------
// PRE-SAVE TRIGGER (runs BEFORE saving)
// ------------------------------------------
imageValidationSchema.pre('save', function(next) {
  console.log('🔷 TRIGGER [PRE-SAVE]: Running before save...');
  console.log(`   Document ID: ${this._id}`);
  console.log(`   Filename: ${this.filename}`);
  
  // Auto-update the updatedAt timestamp
  this.updatedAt = new Date();
  
  // Auto-increment version on update
  if (!this.isNew) {
    this.version += 1;
    console.log(`   Version incremented to: ${this.version}`);
  }
  
  // Auto-generate imageUrl if not provided
  if (!this.imageUrl && this.filename) {
    this.imageUrl = '/uploads/' + this.filename;
    console.log(`   Auto-generated imageUrl: ${this.imageUrl}`);
  }
  
  console.log('🔷 TRIGGER [PRE-SAVE]: Completed');
  next();
});

// ------------------------------------------
// POST-SAVE TRIGGER (runs AFTER saving)
// ------------------------------------------
imageValidationSchema.post('save', function(doc) {
  console.log('✅ TRIGGER [POST-SAVE]: Document saved successfully!');
  console.log(`   Document ID: ${doc._id}`);
  console.log(`   Filename: ${doc.filename}`);
  console.log(`   Created At: ${doc.createdAt}`);
  
  // Example: You could send notifications, update caches, or log to external service
  // await notificationService.send('New image uploaded: ' + doc.filename);
});

// ------------------------------------------
// PRE-FIND TRIGGER (runs BEFORE queries)
// ------------------------------------------
imageValidationSchema.pre('find', function() {
  console.log('🔍 TRIGGER [PRE-FIND]: Query executing...');
  console.log(`   Query filter:`, JSON.stringify(this.getFilter()));
  
  // Example: Auto-add filters, log queries, measure performance
  this._startTime = Date.now();
});

// ------------------------------------------
// POST-FIND TRIGGER (runs AFTER queries)
// ------------------------------------------
imageValidationSchema.post('find', function(docs) {
  const duration = Date.now() - (this._startTime || Date.now());
  console.log(`🔍 TRIGGER [POST-FIND]: Query completed in ${duration}ms`);
  console.log(`   Results count: ${docs.length}`);
});

// ------------------------------------------
// PRE-DELETE TRIGGER (runs BEFORE delete)
// ------------------------------------------
imageValidationSchema.pre('findOneAndDelete', function(next) {
  console.log('🗑️ TRIGGER [PRE-DELETE]: About to delete document...');
  console.log(`   Filter:`, JSON.stringify(this.getFilter()));
  
  // Example: You could backup the document before deletion
  // await BackupModel.create({ deletedDoc: this.getFilter(), deletedAt: new Date() });
  
  next();
});

// ------------------------------------------
// POST-DELETE TRIGGER (runs AFTER delete)
// ------------------------------------------
imageValidationSchema.post('findOneAndDelete', function(doc) {
  if (doc) {
    console.log('🗑️ TRIGGER [POST-DELETE]: Document deleted!');
    console.log(`   Deleted filename: ${doc.filename}`);
    
    // Example: Clean up related files, update statistics
    // await fs.unlink(doc.filepath);
    // await StatsModel.updateOne({}, { $inc: { totalImages: -1 } });
  }
});

// ------------------------------------------
// PRE-UPDATE TRIGGER
// ------------------------------------------
imageValidationSchema.pre('findOneAndUpdate', function(next) {
  console.log('📝 TRIGGER [PRE-UPDATE]: About to update document...');
  
  // Auto-update the updatedAt field
  this.set({ updatedAt: new Date() });
  
  // Auto-increment version
  this.set({ $inc: { version: 1 } });
  
  console.log(`   Update operation:`, JSON.stringify(this.getUpdate()));
  next();
});

// ------------------------------------------
// POST-UPDATE TRIGGER
// ------------------------------------------
imageValidationSchema.post('findOneAndUpdate', function(doc) {
  if (doc) {
    console.log('📝 TRIGGER [POST-UPDATE]: Document updated!');
    console.log(`   Updated filename: ${doc.filename}`);
    console.log(`   New version: ${doc.version}`);
  }
});

// ------------------------------------------
// ERROR HANDLING TRIGGER
// ------------------------------------------
imageValidationSchema.post('save', function(error, doc, next) {
  if (error.name === 'ValidationError') {
    console.log('❌ TRIGGER [ERROR]: Validation failed!');
    for (let field in error.errors) {
      console.log(`   Field "${field}": ${error.errors[field].message}`);
    }
  }
  next(error);
});


// ============================================
// PART 3: STATIC METHODS FOR TESTING
// ============================================

// Static method to demonstrate assertions
imageValidationSchema.statics.testAssertions = async function() {
  console.log('\n========================================');
  console.log('  TESTING ASSERTIONS (Schema Validation)');
  console.log('========================================\n');
  
  const tests = [
    {
      name: 'Valid Image',
      data: {
        filename: 'test_image.jpg',
        originalName: 'My Test Image.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        tags: ['nature', 'landscape']
      },
      shouldPass: true
    },
    {
      name: 'Missing Required Field',
      data: {
        originalName: 'No filename.jpg',
        mimetype: 'image/jpeg'
      },
      shouldPass: false
    },
    {
      name: 'Invalid Mimetype',
      data: {
        filename: 'test.txt',
        originalName: 'test.txt',
        mimetype: 'text/plain'  // Invalid!
      },
      shouldPass: false
    },
    {
      name: 'File Too Large',
      data: {
        filename: 'huge.jpg',
        originalName: 'huge.jpg',
        mimetype: 'image/jpeg',
        size: 100 * 1024 * 1024  // 100MB - exceeds limit!
      },
      shouldPass: false
    },
    {
      name: 'Invalid Tag Length',
      data: {
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimetype: 'image/jpeg',
        tags: ['']  // Empty tag - invalid!
      },
      shouldPass: false
    }
  ];
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Expected: ${test.shouldPass ? 'PASS' : 'FAIL'}`);
    
    try {
      const doc = new this(test.data);
      await doc.validate();
      console.log(`   Result: ✅ PASSED (Validation succeeded)`);
    } catch (error) {
      console.log(`   Result: ❌ FAILED`);
      console.log(`   Error: ${error.message}`);
    }
  }
};

// Static method to demonstrate triggers
imageValidationSchema.statics.testTriggers = async function() {
  console.log('\n========================================');
  console.log('  TESTING TRIGGERS (Middleware Hooks)');
  console.log('========================================\n');
  
  // Test 1: Create (triggers pre-save, post-save)
  console.log('\n--- Test 1: CREATE ---');
  const newDoc = new this({
    filename: 'trigger_test.jpg',
    originalName: 'Trigger Test Image.jpg',
    mimetype: 'image/jpeg',
    size: 2048,
    tags: ['test', 'trigger']
  });
  const savedDoc = await newDoc.save();
  console.log(`Saved document ID: ${savedDoc._id}`);
  
  // Test 2: Find (triggers pre-find, post-find)
  console.log('\n--- Test 2: FIND ---');
  await this.find({ filename: 'trigger_test.jpg' });
  
  // Test 3: Update (triggers pre-update, post-update)
  console.log('\n--- Test 3: UPDATE ---');
  await this.findOneAndUpdate(
    { _id: savedDoc._id },
    { $set: { tags: ['updated', 'test'] } },
    { new: true }
  );
  
  // Test 4: Delete (triggers pre-delete, post-delete)
  console.log('\n--- Test 4: DELETE ---');
  await this.findOneAndDelete({ _id: savedDoc._id });
  
  console.log('\n========================================');
  console.log('  TRIGGERS TEST COMPLETED');
  console.log('========================================\n');
};

const ImageWithValidation = mongoose.model('ImageWithValidation', imageValidationSchema);

module.exports = ImageWithValidation;
