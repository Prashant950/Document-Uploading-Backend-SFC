import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  adminMobile: process.env.ADMIN_MOBILE,
  messageCentral: {
    baseUrl: process.env.MESSAGECENTRAL_BASE_URL || "https://cpaas.messagecentral.com",
    customerId: process.env.MESSAGECENTRAL_CUSTOMER_ID,
    authToken: process.env.MESSAGECENTRAL_AUTH_TOKEN, // Legacy token (if using direct token)
    base64Key: process.env.MESSAGECENTRAL_BASE64_KEY, // For token-based auth
    email: process.env.MESSAGECENTRAL_EMAIL, // For token-based auth
    countryCode: process.env.MESSAGECENTRAL_COUNTRY_CODE || "91",
    useTokenAuth: !!process.env.MESSAGECENTRAL_BASE64_KEY, // Use token auth if base64Key is provided
  },
};
