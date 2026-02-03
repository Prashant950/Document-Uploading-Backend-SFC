import bcrypt from "bcrypt";
import { generateOTP, sendOTP } from "./otpGenerator";
import OTP from "../models/OTP";

const OTP_EXPIRY_MINUTES = 2;

export const createAndSendOTP = async ({ mobileNumber, type }) => {
  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OTP.create({
    mobileNumber,
    otpHash,
    type,
    expiresAt,
  });

  await sendOTP(mobileNumber, otp, type);
};

export const verifyOTP = async ({ mobileNumber, otp, type }) => {
  const record = await OTP.findOne({
    mobileNumber,
    type,
    isVerified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record) return false;

  const isMatch = await bcrypt.compare(otp, record.otpHash);
  if (!isMatch) return false;

  record.isVerified = true;
  await record.save();

  return true;
};
