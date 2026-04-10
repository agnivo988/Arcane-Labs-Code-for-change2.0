import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    workspaceName: { type: String, default: 'Main Studio' },
    plan: { type: String, default: 'creator' },
    status: { type: String, default: 'active' },
    promptsGenerated: { type: Number, default: 0 },
    imagesGenerated: { type: Number, default: 0 },
    imagesEdited: { type: Number, default: 0 },
    imagesFused: { type: Number, default: 0 },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    proActivatedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    studioSessionState: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.models.User || mongoose.model('User', userSchema);