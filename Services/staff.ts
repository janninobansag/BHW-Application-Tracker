import { validPassword } from "./password";

export function validBhwAccount(username: string, displayName: string, temporaryPassword: string): boolean {
  return /^[a-z0-9._-]{3,40}$/.test(username) && !!displayName && displayName.length <= 100 &&
    validPassword(temporaryPassword);
}

export function validBarangayName(name: string): boolean {
  return !!name && name.length <= 100;
}
