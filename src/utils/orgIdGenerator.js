// Generate unique organization ID
export const generateOrgId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORG${timestamp}${randomStr}`;
};

