
import dotenv from "dotenv";

dotenv.config();    

export const ensureAdminMobileConfigured = (res) => {
  if (!process.env.ADMIN_MOBILE) {
    res.status(500).json({
      success: false,
      message: "Admin mobile number not configured",
    });
    return false;
  }
  return true;
};
