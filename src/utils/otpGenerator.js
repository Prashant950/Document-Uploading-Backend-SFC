// import axios from "axios";
// import { config } from "../config/config.js";
// import dotenv from "dotenv";
// dotenv.config();

// // In-memory OTP storage for development/fallback
// const otpStorage = new Map();

// // Token cache for MessageCentral authentication
// let tokenCache = {
//   token: null,
//   expiresAt: 0,
// };

// /**
//  * Normalize mobile number - remove country code prefix if present
//  * MessageCentral expects just the mobile number without + or country code
//  */
// export const normalizeNumber = (mobileNumber) => {
//   if (!mobileNumber) return null;
  
//   // Remove any whitespace
//   let cleaned = String(mobileNumber).trim();
  
//   // Remove + sign if present
//   if (cleaned.startsWith("+")) {
//     cleaned = cleaned.substring(1);
//   }
  
//   // Remove country code if present (91 for India)
//   if (cleaned.startsWith("91") && cleaned.length > 10) {
//     cleaned = cleaned.substring(2);
//   }
  
//   return cleaned;
// };

// /**
//  * Get mobile number with country code for normalization
//  */
// const getMobileWithCountryCode = (mobileNumber) => {
//   const normalized = normalizeNumber(mobileNumber);
//   return normalized ? `+91${normalized}` : null;
// };

// /**
//  * Generate 6-digit OTP on server when needed (for fallback/dev mode)
//  */
// export const generateOTP = () => {
//   return Math.floor(100000 + Math.random() * 900000).toString();
// };

// /**
//  * Get MessageCentral authentication token
//  * Uses token caching to avoid too many auth requests
//  */
// export const getMessageCentralToken = async () => {
//   try {
//     // Check if we have a valid cached token
//     if (tokenCache.token && tokenCache.expiresAt > Date.now()) {
//       console.log("✅ Using cached MessageCentral token");
//       return tokenCache.token;
//     }

//     // Check if token auth is configured
//     if (!config.messageCentral.useTokenAuth) {
//       // Fallback to direct authToken if available
//       if (config.messageCentral.authToken) {
//         return config.messageCentral.authToken;
//       }
//       throw new Error("MessageCentral authentication not configured. Please set MESSAGECENTRAL_BASE64_KEY and MESSAGECENTRAL_EMAIL, or MESSAGECENTRAL_AUTH_TOKEN.");
//     }

//     if (!config.messageCentral.base64Key || !config.messageCentral.email || !config.messageCentral.customerId) {
//       throw new Error("MessageCentral token auth requires MESSAGECENTRAL_BASE64_KEY, MESSAGECENTRAL_EMAIL, and MESSAGECENTRAL_CUSTOMER_ID");
//     }

//     console.log("🔐 Fetching new MessageCentral token...");

//     const response = await axios.get(
//       `${config.messageCentral.baseUrl}/auth/v1/authentication/token`,
//       {
//         params: {
//           customerId: config.messageCentral.customerId,
//           key: config.messageCentral.base64Key,
//           scope: "NEW",
//           country: config.messageCentral.countryCode || "91",
//           email: config.messageCentral.email,
//         },
//       }
//     );

//     const token = response.data?.token || response.data?.data?.token;

//     if (!token) {
//       console.error("❌ MessageCentral Auth Error: No token in response", response.data);
//       throw new Error("MessageCentral authentication failed: No token received");
//     }

//     // Cache token for 50 minutes (tokens typically expire in 60 minutes)
//     tokenCache = {
//       token,
//       expiresAt: Date.now() + 50 * 60 * 1000, // 50 minutes
//     };

//     console.log("✅ MessageCentral token obtained and cached");
//     return token;
//   } catch (error) {
//     console.error("❌ MessageCentral Auth Error:", {
//       message: error.message,
//       response: error.response?.data,
//       status: error.response?.status,
//     });
//     throw new Error(`MessageCentral authentication failed: ${error.message}`);
//   }
// };

// /**
//  * Send OTP using MessageCentral API
//  * @param {string} mobileNumber - Mobile number (will be normalized)
//  * @param {string|null} otp - Optional OTP code (not used with MessageCentral, they generate it)
//  * @param {string} type - Type of OTP (for logging purposes)
//  * @returns {Promise<Object>} - Returns verification object with verificationId
//  */
// export const sendOTP = async (mobileNumber, otp = null, type = "verification") => {
//   if (!mobileNumber) {
//     throw new Error("Mobile number is required");
//   }
  
//   const normalizedMobile = normalizeNumber(mobileNumber);
  
//   if (!normalizedMobile) {
//     throw new Error(`Invalid mobile number: ${mobileNumber}`);
//   }
  
//   console.log("📱 sendOTP called - Input:", mobileNumber, "Normalized:", normalizedMobile);

//   // Check if MessageCentral is configured
//   if (!config.messageCentral.customerId) {
//     console.warn("⚠️  MessageCentral not configured. Using development fallback mode.");
    
//     // Development fallback
//     const generatedOtp = generateOTP();
//     const mobileWithCountry = getMobileWithCountryCode(mobileNumber);
    
//     otpStorage.set(mobileWithCountry, {
//       code: generatedOtp,
//       verificationId: `DEVMODE_${Date.now()}`,
//       createdAt: Date.now(),
//       expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
//     });
    
//     console.log(`✅ DEV MODE: OTP stored - ${mobileWithCountry}: ${generatedOtp}`);
    
//     return {
//       verificationId: `DEVMODE_${Date.now()}`,
//       status: "pending",
//       sid: `DEVMODE_${Date.now()}`,
//     };
//   }

//   try {
//     // Get authentication token
//     const authToken = await getMessageCentralToken();

//     const baseUrl = config.messageCentral.baseUrl;
//     const customerId = config.messageCentral.customerId;
//     const countryCode = config.messageCentral.countryCode;

//     // Build URL with query parameters
//     const url = `${baseUrl}/verification/v3/send?countryCode=${countryCode}&customerId=${customerId}&flowType=SMS&mobileNumber=${normalizedMobile}`;

//     console.log("📱 Sending OTP via MessageCentral:", {
//       mobileNumber: normalizedMobile,
//       countryCode,
//       customerId,
//       type,
//     });

//     // Make POST request to MessageCentral
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         authToken: authToken,
//         "Content-Type": "application/json",
//       },
//     });

//     if (!response.ok) {
//       let errorText = "";
//       try {
//         errorText = await response.text();
//       } catch (e) {
//         errorText = "Unable to read error response";
//       }
      
//       console.error("MessageCentral Send OTP Error:", {
//         status: response.status,
//         statusText: response.statusText,
//         error: errorText,
//         url: url.replace(authToken, "***"), // Hide token in logs
//       });
      
//       // If 401, clear token cache and retry once
//       if (response.status === 401) {
//         console.warn("⚠️  401 Error - Clearing token cache and retrying...");
//         tokenCache = { token: null, expiresAt: 0 };
        
//         // Retry once with new token
//         try {
//           // Add a small delay before retrying
//           await new Promise((resolve) => setTimeout(resolve, 500));
          
//           const newToken = await getMessageCentralToken();
//           const retryResponse = await fetch(url, {
//             method: "POST",
//             headers: {
//               authToken: newToken,
//               "Content-Type": "application/json",
//             },
//           });

//           if (!retryResponse.ok) {
//             const retryErrorText = await retryResponse.text();
//             console.error("MessageCentral Retry Send OTP Error:", {
//               status: retryResponse.status,
//               error: retryErrorText,
//             });
//             throw new Error(`MessageCentral API error after retry: ${retryResponse.status}`);
//           }

//           // Continue with retry response
//           const responseText = await retryResponse.text();
//           const responseData = responseText ? JSON.parse(responseText) : {};
          
//           const verificationId = responseData.verificationId || responseData.id || responseData.verification_id || `MC_${Date.now()}`;
//           const mobileWithCountry = getMobileWithCountryCode(mobileNumber);
          
//           if (mobileWithCountry) {
//             otpStorage.set(mobileWithCountry, {
//               verificationId,
//               createdAt: Date.now(),
//               expiresAt: Date.now() + 10 * 60 * 1000,
//               responseData,
//             });
//           }

//           console.log("✅ OTP sent successfully after retry");
//           return {
//             verificationId,
//             status: responseData.status || "pending",
//             sid: verificationId,
//             ...responseData,
//           };
//         } catch (retryError) {
//           console.error("MessageCentral authentication failed (401) on retry:", retryError.message);
//           throw new Error(`MessageCentral authentication failed (401). Please check your credentials in .env file.`);
//         }
//       }
      
//       throw new Error(`MessageCentral API error: ${response.status} - ${errorText || response.statusText}`);
//     }

//     let responseData;
//     try {
//       const responseText = await response.text();
//       responseData = responseText ? JSON.parse(responseText) : {};
//     } catch (e) {
//       console.warn("MessageCentral response is not JSON, using empty object");
//       responseData = {};
//     }
//     console.log("✅ MessageCentral OTP sent successfully:", responseData);

//     // Extract verificationId from response
//     const verificationId = responseData.verificationId || responseData.id || responseData.verification_id || responseData.data?.verificationId || `MC_${Date.now()}`;

//     // Store verificationId in memory for fallback verification
//     const mobileWithCountry = getMobileWithCountryCode(mobileNumber);
//     if (mobileWithCountry) {
//       otpStorage.set(mobileWithCountry, {
//         verificationId,
//         createdAt: Date.now(),
//         expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
//         responseData,
//       });
//     }

//     return {
//       verificationId,
//       status: responseData.status || "pending",
//       sid: verificationId, // For compatibility with existing code
//       ...responseData,
//     };
//   } catch (err) {
//     console.error("❌ MessageCentral Send OTP Error:", {
//       message: err.message,
//       mobileNumber: normalizedMobile,
//     });

//     // Fallback to dev mode on error
//     console.warn("⚠️  Falling back to development mode due to error.");
//     const generatedOtp = generateOTP();
//     const mobileWithCountry = getMobileWithCountryCode(mobileNumber);
    
//     if (mobileWithCountry) {
//       otpStorage.set(mobileWithCountry, {
//         code: generatedOtp,
//         verificationId: `FALLBACK_${Date.now()}`,
//         createdAt: Date.now(),
//         expiresAt: Date.now() + 10 * 60 * 1000,
//       });
      
//       console.log(`✅ FALLBACK MODE: OTP stored - ${mobileWithCountry}: ${generatedOtp}`);
//     }
    
//     return {
//       verificationId: `FALLBACK_${Date.now()}`,
//       status: "pending",
//       sid: `FALLBACK_${Date.now()}`,
//     };
//   }
// };

// /**
//  * Verify OTP using MessageCentral API
//  * @param {string} mobileNumber - Mobile number (will be normalized)
//  * @param {string} otp - OTP code to verify
//  * @param {string|null} verificationId - Optional verificationId (will be looked up if not provided)
//  * @param {number} retryCount - Retry count for transient failures
//  * @returns {Promise<boolean>} - Returns true if OTP is valid
//  */
// export const verifyOTP = async (mobileNumber, otp, verificationId = null, retryCount = 0) => {
//   const normalizedMobile = normalizeNumber(mobileNumber);
//   const MAX_RETRIES = 2;

//   if (!normalizedMobile) {
//     console.error("VERIFY OTP - Invalid mobile number");
//     return false;
//   }

//   // Validate OTP is a string and has content
//   if (!otp || typeof otp !== "string" || otp.trim().length === 0) {
//     console.error("VERIFY OTP - Invalid OTP format:", { otp, type: typeof otp });
//     return false;
//   }

//   const cleanOtp = otp.trim().replace(/\D/g, ""); // Remove non-digits

//   if (cleanOtp.length < 4 || cleanOtp.length > 8) {
//     console.error("VERIFY OTP - Invalid OTP length:", cleanOtp.length);
//     return false;
//   }

//   const mobileWithCountry = getMobileWithCountryCode(mobileNumber);

//   // Check development/fallback storage first
//   if (otpStorage.has(mobileWithCountry)) {
//     console.log(`📱 Checking development OTP storage for ${mobileWithCountry}`);
    
//     const storedOtp = otpStorage.get(mobileWithCountry);
    
//     // Check expiry
//     if (storedOtp.expiresAt < Date.now()) {
//       console.warn(`⚠️  OTP expired for ${mobileWithCountry}`);
//       otpStorage.delete(mobileWithCountry);
//       return false;
//     }

//     // If we have a code in storage (dev/fallback mode), verify it
//     if (storedOtp.code) {
//       if (storedOtp.code !== cleanOtp) {
//         console.warn(`⚠️  Invalid OTP code for ${mobileWithCountry}. Expected: ${storedOtp.code}, Got: ${cleanOtp}`);
//         return false;
//       }

//       console.log(`✅ OTP verified successfully (dev mode) for ${mobileWithCountry}`);
//       otpStorage.delete(mobileWithCountry);
//       return true;
//     }

//     // Use stored verificationId if not provided
//     if (!verificationId && storedOtp.verificationId) {
//       verificationId = storedOtp.verificationId;
//     }
//   }

//   // If no MessageCentral config, return false
//   if (!config.messageCentral.customerId) {
//     console.warn("⚠️  No OTP found in storage and MessageCentral not configured.");
//     return false;
//   }

//   // Use verificationId from parameter or try to find it
//   if (!verificationId) {
//     console.warn("⚠️  No verificationId provided. Attempting to verify anyway.");
//   }

//   try {
//     // Get authentication token
//     const authToken = await getMessageCentralToken();

//     const baseUrl = config.messageCentral.baseUrl;
//     const customerId = config.messageCentral.customerId;
//     const countryCode = config.messageCentral.countryCode;

//     // Build URL with query parameters
//     let url = `${baseUrl}/verification/v3/validateOtp?countryCode=${countryCode}&mobileNumber=${normalizedMobile}&customerId=${customerId}&code=${cleanOtp}`;
    
//     // Add verificationId if available
//     if (verificationId) {
//       url += `&verificationId=${verificationId}`;
//     }

//     console.log("🔐 Verifying OTP via MessageCentral:", {
//       mobileNumber: normalizedMobile,
//       otpLength: cleanOtp.length,
//       hasVerificationId: !!verificationId,
//     });

//     // Make GET request to MessageCentral
//     const response = await fetch(url, {
//       method: "GET",
//       headers: {
//         authToken: authToken,
//         "Content-Type": "application/json",
//       },
//     });

//     if (!response.ok) {
//       let errorText = "";
//       try {
//         errorText = await response.text();
//       } catch (e) {
//         errorText = "Unable to read error response";
//       }
      
//       console.error("MessageCentral Verify OTP Error:", {
//         status: response.status,
//         statusText: response.statusText,
//         error: errorText,
//       });

//       // If 404 or invalid, don't retry
//       if (response.status === 404 || response.status === 400) {
//         return false;
//       }

//       // If 401, clear token cache and retry once
//       if (response.status === 401) {
//         console.warn("⚠️  401 Error - Clearing token cache and retrying...");
//         tokenCache = { token: null, expiresAt: 0 };
        
//         try {
//           const newToken = await getMessageCentralToken();
//           const retryResponse = await fetch(url, {
//             method: "GET",
//             headers: {
//               authToken: newToken,
//               "Content-Type": "application/json",
//             },
//           });

//           if (!retryResponse.ok) {
//             return false;
//           }

//           const responseText = await retryResponse.text();
//           const responseData = responseText ? JSON.parse(responseText) : {};
          
//           const isValid = 
//             responseData.status === "approved" ||
//             responseData.status === "success" ||
//             responseData.isValid === true ||
//             responseData.valid === true ||
//             (responseData.message && responseData.message.toLowerCase().includes("success"));

//           if (isValid && mobileWithCountry) {
//             otpStorage.delete(mobileWithCountry);
//           }

//           return isValid;
//         } catch (retryError) {
//           console.error("MessageCentral authentication failed (401) on retry.");
//           return false;
//         }
//       }

//       throw new Error(`MessageCentral API error: ${response.status} - ${errorText || response.statusText}`);
//     }

//     let responseData;
//     try {
//       const responseText = await response.text();
//       responseData = responseText ? JSON.parse(responseText) : {};
//     } catch (e) {
//       console.warn("MessageCentral response is not JSON, using empty object");
//       responseData = {};
//     }
//     console.log("✅ MessageCentral OTP verification result:", responseData);

//     // Check if verification was successful
//     const isValid = 
//       responseData.status === "approved" ||
//       responseData.status === "success" ||
//       responseData.isValid === true ||
//       responseData.valid === true ||
//       responseData.data?.isValid === true ||
//       (responseData.message && responseData.message.toLowerCase().includes("success"));

//     if (isValid && mobileWithCountry) {
//       // Clear from storage on successful verification
//       otpStorage.delete(mobileWithCountry);
//     }

//     return isValid;
//   } catch (err) {
//     console.error("VERIFY OTP - MessageCentral error:", {
//       message: err.message,
//       code: err.code,
//       mobileNumber: normalizedMobile,
//     });

//     // Retry on network errors (NOT on invalid parameter errors)
//     if (
//       retryCount < MAX_RETRIES &&
//       (err.message?.includes("socket hang up") ||
//         err.message?.includes("ECONNRESET") ||
//         err.message?.includes("ETIMEDOUT") ||
//         err.message?.includes("fetch failed") ||
//         err.code === "ECONNRESET" ||
//         err.code === "ETIMEDOUT")
//     ) {
//       console.log(`Retrying OTP verification (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       return verifyOTP(mobileNumber, cleanOtp, verificationId, retryCount + 1);
//     }

//     return false;
//   }
// };


import axios from "axios";
import { config } from "../config/config.js";

/* ================= HELPERS ================= */

export const normalizeNumber = (mobileNumber) => {
  let m = String(mobileNumber).trim();
  if (m.startsWith("+")) m = m.substring(1);
  if (m.startsWith("91") && m.length > 10) m = m.substring(2);
  return m;
};

/* ================= TOKEN ================= */

let AUTH_TOKEN = null;
let TOKEN_EXPIRES = 0;

const getToken = async () => {
  if (AUTH_TOKEN && TOKEN_EXPIRES > Date.now()) {
    console.log("✅ Using cached token, expires in:", Math.round((TOKEN_EXPIRES - Date.now()) / 1000), "seconds");
    return AUTH_TOKEN;
  }

  console.log("🔐 Fetching new MessageCentral token...");
  console.log("📋 Token request config:", {
    baseUrl: config.messageCentral.baseUrl,
    customerId: config.messageCentral.customerId ? "✅ SET" : "❌ MISSING",
    base64Key: config.messageCentral.base64Key ? "✅ SET" : "❌ MISSING",
    email: config.messageCentral.email ? "✅ SET" : "❌ MISSING",
    countryCode: config.messageCentral.countryCode,
  });
  
  try {
    const res = await axios.get(
      `${config.messageCentral.baseUrl}/auth/v1/authentication/token`,
      {
        params: {
          customerId: config.messageCentral.customerId,
          key: config.messageCentral.base64Key,
          scope: "NEW",
          country: config.messageCentral.countryCode,
          email: config.messageCentral.email,
        },
      }
    );

    AUTH_TOKEN = res.data.token;
    TOKEN_EXPIRES = Date.now() + 50 * 60 * 1000; // 50 min

    console.log("✅ New token obtained:", {
      tokenLength: AUTH_TOKEN?.length,
      tokenPrefix: AUTH_TOKEN?.substring(0, 20) + "...",
      expiresIn: "50 minutes",
      responseStatus: res.status,
    });
    
    return AUTH_TOKEN;
  } catch (error) {
    console.error("❌ Token fetch FAILED:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      responseData: error.response?.data,
      endpoint: `${config.messageCentral.baseUrl}/auth/v1/authentication/token`,
    });
    throw new Error(`MessageCentral token authentication failed: ${error.message}`);
  }
};

/* ================= SEND OTP ================= */

export const sendOTP = async (mobileNumber, retryCount = 0) => {
  const mobile = normalizeNumber(mobileNumber);
  const token = await getToken();

  const url = `${config.messageCentral.baseUrl}/verification/v3/send`;

  console.log("📱 Sending OTP via MessageCentral to:", mobile);

  try {
    const res = await axios.post(
      url,
      null,
      {
        params: {
          countryCode: config.messageCentral.countryCode,
          customerId: config.messageCentral.customerId,
          flowType: "SMS",
          mobileNumber: mobile,
        },
        headers: {
          authToken: token,
        },
      }
    );

    // 🔥 CORRECT LOCATION
    const verificationId = res.data?.data?.verificationId;

    if (!verificationId) {
      console.error("❌ verificationId missing from MessageCentral response", res.data);
      throw new Error("verificationId missing from MessageCentral");
    }

    console.log("✅ OTP SENT SUCCESSFULLY:", {
      mobile,
      verificationId,
      timeout: res.data?.data?.timeout,
    });

    return {
      verificationId,
      sid: verificationId,
      status: res.data?.message || "SUCCESS",
    };
  } catch (error) {
    console.error("❌ OTP Send FAILED:", {
      status: error.response?.status,
      message: error.message,
      response: error.response?.data,
      retryCount,
    });

    // 🔁 Retry once on 401
    if (error.response?.status === 401 && retryCount === 0) {
      AUTH_TOKEN = null;
      TOKEN_EXPIRES = 0;
      await new Promise((r) => setTimeout(r, 500));
      return sendOTP(mobileNumber, 1);
    }

    throw error;
  }
};


/* ================= VERIFY OTP ================= */

// export const verifyOTP = async (mobileNumber, otp, verificationId = null, retryCount = 0) => {
//   const mobile = normalizeNumber(mobileNumber);
//   const code = String(otp).trim();

//   console.log("🔐 OTP Verification Request:", {
//     mobileNumber: mobile,
//     codeLength: code.length,
//     hasVerificationId: !!verificationId,
//     verificationId: verificationId || "NOT PROVIDED ⚠️",
//     retryCount,
//   });

//   if (code.length !== 4) {
//     console.warn("❌ OTP code must be 4 digits, got:", code.length);
//     return false;
//   }

//   try {
//     const token = await getToken();

//     // Build params with verificationId if provided
//     const params = {
//       countryCode: config.messageCentral.countryCode,
//       customerId: config.messageCentral.customerId,
//       mobileNumber: mobile,
//       code,
//     };

//     // Add verificationId if provided
//     if (verificationId) {
//       params.verificationId = verificationId;
//     }

//     console.log("📤 Calling MessageCentral /verification/v3/validateOtp:", {
//       url: `${config.messageCentral.baseUrl}/verification/v3/validateOtp`,
//       params: {
//         ...params,
//         code: "****", // Hide actual code in logs
//       },
//       tokenReceived: !!token,
//       tokenLength: token?.length,
//     });

//     const res = await axios.get(
//       `${config.messageCentral.baseUrl}/verification/v3/validateOtp`,
//       {
//         params,
//         headers: {
//           authToken: token,
//         },
//       }
//     );

//     const success = res.data?.status === "success" || res.data?.isValid === true;
    
//     console.log("📥 MessageCentral Verify Response:", {
//       status: res.data?.status,
//       isValid: res.data?.isValid,
//       success,
//       statusCode: res.status,
//       fullResponse: res.data,
//     });

//     return success;
//   } catch (err) {
//     console.error("❌ OTP Verification FAILED:", {
//       status: err.response?.status,
//       statusText: err.response?.statusText,
//       message: err.message,
//       responseData: err.response?.data,
//       retryCount,
//       url: `${config.messageCentral.baseUrl}/verification/v3/validateOtp`,
//     });

//     // Only retry once on 401
//     if (err.response?.status === 401 && retryCount === 0) {
//       console.warn("⚠️ 401 Error - Token invalid, clearing and retrying once...");
//       AUTH_TOKEN = null;
//       TOKEN_EXPIRES = 0;
      
//       await new Promise((resolve) => setTimeout(resolve, 500));
//       return verifyOTP(mobileNumber, otp, verificationId, 1);
//     }
    
//     return false;
//   }
// };

export const verifyOTP = async (mobileNumber, otp, verificationId) => {
  if (!verificationId) {
    console.error("❌ verificationId missing");
    return false;
  }

  const mobile = normalizeNumber(mobileNumber);
  const code = String(otp).trim();

  if (!/^\d{4,6}$/.test(code)) {
    console.warn("❌ Invalid OTP format:", code);
    return false;
  }

  try {
    const token = await getToken();

    const res = await axios.get(
      `${config.messageCentral.baseUrl}/verification/v3/validateOtp`,
      {
        params: {
          countryCode: config.messageCentral.countryCode,
          customerId: config.messageCentral.customerId,
          mobileNumber: mobile,
          code,
          verificationId,
        },
        headers: {
          authToken: token,
        },
      }
    );

    const status = String(res.data?.status || res.data?.data?.status || "").toLowerCase();

    const isValid =
      status === "success" ||
      status === "approved" ||
      res.data?.isValid === true ||
      res.data?.valid === true ||
      res.data?.data?.isValid === true ||
      (res.data?.message && String(res.data.message).toLowerCase().includes("success"));

    return Boolean(isValid);
  } catch (err) {
    console.error("❌ OTP Verify Failed:", {
      status: err.response?.status,
      data: err.response?.data,
    });
    return false;
  }
};
