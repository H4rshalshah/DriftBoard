import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  type IProjectSettings,
  type ICreateProjectDto,
  type IUpdateProjectDto,
} from '../types/index.js';

export interface IProjectDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  teamId: mongoose.Types.ObjectId;
  endpointIds: mongoose.Types.ObjectId[];
  settings: IProjectSettings;
  tags: string[];
  getEndpointCount(): Promise<number>;
  toPublicObject(): Record<string, unknown>;
}

interface IProjectModel extends Model<IProjectDocument> {
  findBySlug(teamId: string | mongoose.Types.ObjectId, slug: string): Promise<IProjectDocument | null>;
  build(dto: ICreateProjectDto): Promise<IProjectDocument>;
}

const projectSettingsSchema = new Schema<IProjectSettings>(
  {
    retentionDays: { type: Number, default: 90, min: 7, max: 365 },
    autoRemediate: { type: Boolean, default: false },
    diffContext: { type: Number, default: 3, min: 1, max: 10 },
  },
  { _id: false },
);

const projectSchema = new Schema<IProjectDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    endpointIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Endpoint',
      default: [],
    },
    settings: {
      type: projectSettingsSchema,
      default: () => ({}),
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ teamId: 1, slug: 1 }, { unique: true });
projectSchema.index({ teamId: 1 });

projectSchema.virtual('endpointCount').get(function () {
  return this.endpointIds.length;
});

projectSchema.methods.getEndpointCount = async function (): Promise<number> {
  return mongoose.model('Endpoint').countDocuments({ projectId: this._id });
};

projectSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    teamId: this.teamId,
    endpointCount: this.endpointIds.length,
    settings: this.settings,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

projectSchema.statics.findBySlug = async function (
  teamId: string | mongoose.Types.ObjectId,
  slug: string,
): Promise<IProjectDocument | null> {
  const objectId = typeof teamId === 'string' ? new mongoose.Types.ObjectId(teamId) : teamId;
  return this.findOne({ teamId: objectId, slug: slug.toLowerCase() });
};

projectSchema.statics.build = async function (dto: ICreateProjectDto): Promise<IProjectDocument> {
  const project = new this({
    name: dto.name,
    slug: dto.slug,
    description: dto.description,
    teamId: new mongoose.Types.ObjectId(dto.teamId),
    tags: dto.tags || [],
  });

  return project.save();
};

export const ProjectModel = mongoose.model<IProjectDocument, IProjectModel>('Project', projectSchema);