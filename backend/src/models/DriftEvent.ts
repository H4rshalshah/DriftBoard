import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  DriftSeverity,
  type IChange,
  type ICreateDriftEventDto,
} from '../types/index.js';

export interface IDriftEventDocument extends Document {
  endpointId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  severity: DriftSeverity;
  changes: IChange[];
  diff: Record<string, unknown>;
  detectedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: mongoose.Types.ObjectId;
  getSeverityLevel(): number;
  isBreaking(): boolean;
  toPublicObject(): Record<string, unknown>;
}

interface IDriftEventModel extends Model<IDriftEventDocument> {
  findByProject(
    projectId: string | mongoose.Types.ObjectId,
    options?: { limit?: number; skip?: number; severity?: DriftSeverity },
  ): Promise<IDriftEventDocument[]>;
  findUnacknowledged(
    projectId: string | mongoose.Types.ObjectId,
  ): Promise<IDriftEventDocument[]>;
  build(dto: ICreateDriftEventDto): Promise<IDriftEventDocument>;
}

const changeSchema = new Schema<IChange>(
  {
    type: {
      type: String,
      enum: ['added', 'removed', 'modified'],
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { _id: false },
);

const driftEventSchema = new Schema<IDriftEventDocument>(
  {
    endpointId: {
      type: Schema.Types.ObjectId,
      ref: 'Endpoint',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(DriftSeverity),
      required: true,
      index: true,
    },
    changes: {
      type: [changeSchema],
      default: [],
    },
    diff: {
      type: Schema.Types.Mixed,
      default: {},
    },
    detectedAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

driftEventSchema.index({ projectId: 1, detectedAt: -1 });
driftEventSchema.index({ endpointId: 1, detectedAt: -1 });
driftEventSchema.index({ projectId: 1, severity: 1, detectedAt: -1 });

driftEventSchema.virtual('isAcknowledged').get(function () {
  return !!this.acknowledgedAt;
});

driftEventSchema.virtual('changeCount').get(function () {
  return this.changes.length;
});

driftEventSchema.methods.getSeverityLevel = function (): number {
  const levels: Record<DriftSeverity, number> = {
    [DriftSeverity.LOW]: 1,
    [DriftSeverity.MEDIUM]: 2,
    [DriftSeverity.BREAKING]: 3,
  };
  return levels[this.severity] || 0;
};

driftEventSchema.methods.isBreaking = function (): boolean {
  return this.severity === DriftSeverity.BREAKING;
};

driftEventSchema.methods.toPublicObject = function (): Record<string, unknown> {
  return {
    id: this._id,
    endpointId: this.endpointId,
    projectId: this.projectId,
    severity: this.severity,
    changes: this.changes,
    diff: this.diff,
    detectedAt: this.detectedAt,
    acknowledgedAt: this.acknowledgedAt,
    acknowledgedBy: this.acknowledgedBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

driftEventSchema.statics.findByProject = async function (
  projectId: string | mongoose.Types.ObjectId,
  options: { limit?: number; skip?: number; severity?: DriftSeverity } = {},
): Promise<IDriftEventDocument[]> {
  const objectId = typeof projectId === 'string' ? new mongoose.Types.ObjectId(projectId) : projectId;
  const query: Record<string, unknown> = { projectId: objectId };

  if (options.severity) {
    query.severity = options.severity;
  }

  return this.find(query)
    .sort({ detectedAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

driftEventSchema.statics.findUnacknowledged = async function (
  projectId: string | mongoose.Types.ObjectId,
): Promise<IDriftEventDocument[]> {
  const objectId = typeof projectId === 'string' ? new mongoose.Types.ObjectId(projectId) : projectId;
  return this.find({ projectId: objectId, acknowledgedAt: null }).sort({ detectedAt: -1 });
};

driftEventSchema.statics.build = async function (
  dto: ICreateDriftEventDto,
): Promise<IDriftEventDocument> {
  const event = new this({
    endpointId: new mongoose.Types.ObjectId(dto.endpointId),
    projectId: new mongoose.Types.ObjectId(dto.projectId),
    severity: dto.severity,
    changes: dto.changes,
    diff: dto.diff,
    detectedAt: new Date(),
  });

  return event.save();
};

export const DriftEventModel = mongoose.model<IDriftEventDocument, IDriftEventModel>(
  'DriftEvent',
  driftEventSchema,
);