import mongoose from 'mongoose';

const collaborationLinkSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    session: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

export default mongoose.models.CollaborationLink || mongoose.model('CollaborationLink', collaborationLinkSchema);
