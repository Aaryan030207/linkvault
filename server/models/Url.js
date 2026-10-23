const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema(
  {
    urlCode: {
      type: String,
      required: [true, 'URL code is required'],
      unique: true,
      trim: true,
      minlength: 6,
      index: true
    },
    originalUrl: {
      type: String,
      required: [true, 'Original URL is required'],
      trim: true
    },
    shortUrl: {
      type: String,
      required: [true, 'Short URL is required'],
      trim: true
    },
    clicks: {
      type: Number,
      required: true,
      default: 0
    },
    expiryDays: {
      type: Number,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    lastClickedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Helper method to check if link is expired
urlSchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
};

// Transform output JSON to include expired status flag
urlSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.isExpired = doc.isExpired ? doc.isExpired() : (doc.expiresAt ? new Date() > new Date(doc.expiresAt) : false);
    return ret;
  }
});

module.exports = mongoose.model('Url', urlSchema);
