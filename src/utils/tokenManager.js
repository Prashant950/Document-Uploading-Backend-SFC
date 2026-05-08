import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import RefreshToken from "../models/RefreshToken.js";

/**
 * Generate Access Token (short-lived)
 * @param {Object} payload - Token payload
 * @returns {string} - JWT Access Token (expires in 1 hour)
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "1h" });
};

/**
 * Generate Refresh Token & Save to DB
 * @param {Object} payload - Token payload
 * @param {string} userModel - "User" or "Admin"
 * @returns {Promise<string>} - JWT Refresh Token (expires in 30 days)
 */
export const generateRefreshToken = async (payload, userModel) => {
  const refreshTokenJwt = jwt.sign(payload, config.jwtSecret, {
    expiresIn: "30d",
  });

  // Save refresh token to database
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await RefreshToken.create({
    userId: payload.userId,
    userModel,
    role: payload.role,
    token: refreshTokenJwt,
    isRevoked: false,
    expiresAt,
  });

  return refreshTokenJwt;
};

/**
 * Refresh Access Token using Refresh Token
 * @param {string} refreshToken - Refresh token from database
 * @returns {Promise<Object>} - New access token and refresh token (if needed)
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token signature
    const decoded = jwt.verify(refreshToken, config.jwtSecret);

    // Check if token is revoked in database
    const tokenRecord = await RefreshToken.findOne({
      token: refreshToken,
      isRevoked: false,
    });

    if (!tokenRecord) {
      throw new Error("Refresh token is invalid or has been revoked");
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      throw new Error("Refresh token has expired");
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      role: decoded.role,
      orgId: decoded.orgId,
    });

    return {
      accessToken: newAccessToken,
      refreshToken, // Return same refresh token if still valid
    };
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
};

/**
 * Revoke Refresh Token (Logout)
 * @param {string} refreshToken - Refresh token to revoke
 * @returns {Promise<boolean>} - Success status
 */
export const revokeRefreshToken = async (refreshToken) => {
  try {
    const result = await RefreshToken.findOneAndUpdate(
      { token: refreshToken },
      { isRevoked: true, revokedAt: new Date() },
      { new: true }
    );

    return !!result;
  } catch (error) {
    console.error("❌ REVOKE TOKEN ERROR:", error);
    return false;
  }
};

/**
 * Revoke All Tokens for a User (Logout from all devices)
 * @param {string} userId - User ID
 * @param {string} userModel - "User" or "Admin"
 * @returns {Promise<number>} - Number of tokens revoked
 */
export const revokeAllUserTokens = async (userId, userModel) => {
  try {
    const result = await RefreshToken.updateMany(
      { userId, userModel, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );

    return result.modifiedCount || 0;
  } catch (error) {
    console.error("❌ REVOKE ALL TOKENS ERROR:", error);
    return 0;
  }
};
