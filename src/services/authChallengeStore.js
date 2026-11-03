let passwordChallenge = null;
let otpRequest = null;

// Proof không được lưu vào URL, history state hay Web Storage.
export const setPasswordChallenge = (value) => {
  passwordChallenge = value ? { ...value } : null;
};
export const getPasswordChallenge = () => (passwordChallenge ? { ...passwordChallenge } : null);
export const clearPasswordChallenge = () => {
  passwordChallenge = null;
};
export const setOtpRequest = (value) => {
  otpRequest = value ? { ...value } : null;
};
export const getOtpRequest = () => (otpRequest ? { ...otpRequest } : null);
export const clearOtpRequest = () => {
  otpRequest = null;
};
