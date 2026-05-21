import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IUploadedFileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  originalName: string;
  storedPath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  toPublicObject(): Record<string, unknown>;
}

interface IUploadedFileModel extends Model<IUploadedFileDocument> {
  findByProject(projectId: string | mongoose.Types.ObjectId): Promise<IUploadedFileDocument[]>;
  build(dto: {
    userId: string;
    projectId: string;
    originalName: string;
    storedPath: string;
    fileType: string;
    fileSize: number;
  }): Promise<IUploadedFileDocument>;
}

const uploadedFileSchema = new Schema<IUploadedFileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedPath: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  },
);

uploadedFileSchema.index({ userId: 1, projectId: 1, originalName: 1 });

uploadedFileSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    userId: this.userId,
    projectId: this.projectId,
    originalName: this.originalName,
    storedPath: this.storedPath,
    fileType: this.fileType,
    fileSize: this.fileSize,
    uploadedAt: this.uploadedAt,
  };
};

uploadedFileSchema.statics.findByProject = async function (
  projectId: string | mongoose.Types.ObjectId,
): Promise<IUploadedFileDocument[]> {
  const objectId = typeof projectId === 'string' ? new mongoose.Types.ObjectId(projectId) : projectId;
  return this.find({ projectId: objectId }).sort({ uploadedAt: -1, originalName: 1 });
};

uploadedFileSchema.statics.build = async function (dto): Promise<IUploadedFileDocument> {
  const uploadedFile = new this({
    userId: new mongoose.Types.ObjectId(dto.userId),
    projectId: new mongoose.Types.ObjectId(dto.projectId),
    originalName: dto.originalName,
    storedPath: dto.storedPath,
    fileType: dto.fileType,
    fileSize: dto.fileSize,
  });

  return uploadedFile.save();
};

export const UploadedFileModel = mongoose.model<IUploadedFileDocument, IUploadedFileModel>(
  'UploadedFile',
  uploadedFileSchema,
);
