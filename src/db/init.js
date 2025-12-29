import { connectDB } from "./connection.js";

export const initDB = async () => {
  await connectDB();
};
