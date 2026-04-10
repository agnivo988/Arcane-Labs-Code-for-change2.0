import mongoose from 'mongoose';

export const connectDatabase = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB || 'arcane_engine'
  });

  return mongoose.connection;
};