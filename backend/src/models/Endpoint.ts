import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  HttpMethod,
  type ICreateEndpointDto,
  type IUpdateEndpointDto,
} from '../types/index.js';

export interface IEndpointDocument extends Document {
  path: string;
  method: HttpMethod;
  projectId: mongoose.Types.ObjectId;
  currentSchema: Record<string, unknown>;
  lastSchemaAt?: Date;
  tags: string[];
  description?: string;
  deprecated: boolean;
  isActive(): boolean;
  hasSchemaChanged(newSchema: Record<string, unknown>): boolean;
  toPublicObject(): Record<string, unknown>;
}

interface IEndpointModel extends Model<IEndpointDocument> {
  findByPath(
    projectId: string | mongoose.Types.ObjectId,
    path: string,
    method: HttpMethod,
  ): Promise<IEndpointDocument | null>;
  findByProject(projectId: string | mongoose.Types.ObjectId): Promise<IEndpointDocument[]>;
  build(dto: ICreateEndpointDto): Promise<IEndpointDocument>;
}

const endpointSchema = new Schema<IEndpointDocument>(
  {
    path: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    method: {
      type: String,
      enum: Object.values(HttpMethod),
      required: true,
      uppercase: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    currentSchema: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastSchemaAt: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    deprecated: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

endpointSchema.index({ projectId: 1, path: 1, method: 1 }, { unique: true });
endpointSchema.index({ projectId: 1 });

endpointSchema.virtual('isDeprecated').get(function () {
  return this.deprecated;
});

endpointSchema.virtual('identifier').get(function () {
  return `${this.method}:${this.path}`;
});

endpointSchema.methods.isActive = function (): boolean {
  return !this.deprecated;
};

endpointSchema.methods.hasSchemaChanged = function (
  newSchema: Record<string, unknown>,
): boolean {
  return JSON.stringify(this.currentSchema) !== JSON.stringify(newSchema);
};

endpointSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    path: this.path,
    method: this.method,
    projectId: this.projectId,
    currentSchema: this.currentSchema,
    lastSchemaAt: this.lastSchemaAt,
    tags: this.tags,
    description: this.description,
    deprecated: this.deprecated,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

endpointSchema.statics.findByPath = async function (
  projectId: string | mongoose.Types.ObjectId,
  path: string,
  method: HttpMethod,
): Promise<IEndpointDocument | null> {
  const objectId = typeof projectId === 'string' ? new mongoose.Types.ObjectId(projectId) : projectId;
  return this.findOne({
    projectId: objectId,
    path,
    method: method.toUpperCase(),
  });
};

endpointSchema.statics.findByProject = async function (
  projectId: string | mongoose.Types.ObjectId,
): Promise<IEndpointDocument[]> {
  const objectId = typeof projectId === 'string' ? new mongoose.Types.ObjectId(projectId) : projectId;
  return this.find({ projectId: objectId }).sort({ path: 1, method: 1 });
};

endpointSchema.statics.build = async function (dto: ICreateEndpointDto): Promise<IEndpointDocument> {
  const endpoint = new this({
    path: dto.path,
    method: dto.method.toUpperCase(),
    projectId: new mongoose.Types.ObjectId(dto.projectId),
    description: dto.description,
    tags: dto.tags || [],
    deprecated: dto.deprecated || false,
  });

  return endpoint.save();
};

export const EndpointModel = mongoose.model<IEndpointDocument, IEndpointModel>('Endpoint', endpointSchema);