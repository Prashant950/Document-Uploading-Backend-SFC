import mongoose from "mongoose";

const categoriesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: 'folder',
      enum: [
        'folder',
        'file-document',
        'briefcase',
        'chart-box',
        'clipboard-text',
        'folder-lock',
        'archive',
        'cloud',
      ],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('DocumentCategory', categoriesSchema);