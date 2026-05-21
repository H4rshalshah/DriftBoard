import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ICreateSchemaSnapshotDto, ISchemaMetadata } from '../types/index.js';

export interface ISchemaSnapshotDocument extends Document {
  endpointId: mongoose.Types.ObjectId;
  schema: Record<string, unknown>;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  metadata: ISchemaMetadata;
  version: number;
  getNextVersion(): Promise<number>;
  toPublicObject(): Record<string, unknown>;
}

interface ISchemaSnapshotModel extends Model<ISchemaSnapshotDocument> {
  findByEndpoint(
    endpointId: string | mongoose.Types.ObjectId,
    limit?: number,
  ): Promise<ISchemaSnapshotDocument[]>;
  findLatest(endpointId: string | mongoose.Types.ObjectId): Promise<ISchemaSnapshotDocument | null>;
  build(dto: ICreateSchemaSnapshotDto): Promise<ISchemaSnapshotDocument>;
}

const schemaMetadataSchema = new Schema<ISchemaMetadata>(
  {
    size: { type: Number, default: 0 },
    fieldCount: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
  },
  { _id: false },
);

const schemaSnapshotSchema = new Schema<ISchemaSnapshotDocument>(
  {
    endpointId: {
      type: Schema.Types.ObjectId,
      ref: 'Endpoint',
      required: true,
      index: true,
    },
    schema: {
      type: Schema.Types.Mixed,
      required: true,
    },
    requestSchema: {
      type: Schema.Types.Mixed,
      default: null,
    },
    responseSchema: {
      type: Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: schemaMetadataSchema,
      default: () => ({
        size: 0,
        fieldCount: 0,
        depth: 0,
      }),
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

schemaSnapshotSchema.index({ endpointId: 1, createdAt: -1 });
schemaSnapshotSchema.index({ endpointId: 1, version: -1 });

schemaSnapshotSchema.virtual('sizeInKB').get(function () {
  return Math.round(this.metadata.size / 1024 * 100) / 100;
});

schemaSnapshotSchema.methods.getNextVersion = async function (): Promise<number> {
  const result = await mongoose.model('SchemaSnapshot').aggregate([
    { $match: { endpointId: this.endpointId } },
    { $group: { _id: null, maxVersion: { $max: '$version' } } },
  ]);

  return (result[0]?.maxVersion || 0) + 1;
};

schemaSnapshotSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    endpointId: this.endpointId,
    schema: this.schema,
    requestSchema: this.requestSchema,
    responseSchema: this.responseSchema,
    metadata: this.metadata,
    version: this.version,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

schemaSnapshotSchema.statics.findByEndpoint = async function (
  endpointId: string | mongoose.Types.ObjectId,
  limit: number = 10,
): Promise<ISchemaSnapshotDocument[]> {
  const objectId = typeof endpointId === 'string' ? new mongoose.Types.ObjectId(endpointId) : endpointId;
  return this.find({ endpointId: objectId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

schemaSnapshotSchema.statics.findLatest = async function (
  endpointId: string | mongoose.Types.ObjectId,
): Promise<ISchemaSnapshotDocument | null> {
  const objectId = typeof endpointId === 'string' ? new mongoose.Types.ObjectId(endpointId) : endpointId;
  return this.findOne({ endpointId: objectId }).sort({ version: -1 });
};

schemaSnapshotSchema.statics.build = async function (
  dto: ICreateSchemaSnapshotDto,
): Promise<ISchemaSnapshotDocument> {
  const endpointId = new mongoose.Types.ObjectId(dto.endpointId);

  const latestSnapshot = await this.findOne({ endpointId }).sort({ version: -1 });
  const version = (latestSnapshot?.version || 0) + 1;

  const snapshot = new this({
    endpointId,
    schema: dto.schema,
    requestSchema: dto.requestSchema,
    responseSchema: dto.responseSchema,
    metadata: dto.metadata || { size: 0, fieldCount: 0, depth: 0 },
    version,
  });

  return snapshot.save();
};

export const SchemaSnapshotModel = mongoose.model<ISchemaSnapshotDocument, ISchemaSnapshotModel>(
  'SchemaSnapshot',
  schemaSnapshotSchema,
);