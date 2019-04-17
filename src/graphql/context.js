import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs'; 

let secret = readFileSync('/usr/local/projectfina-keys/secret').split('\n')[0];

export default async function ({ req }) {
  const authorization = req.headers.authorization || null;
  const authToken = (authorization && authorization.startsWith('Bearer ')
    ? authorization.substring(7)
    : null);

  let claims = null;

  if (authToken) {
    try {
      claims = jwt.verify(authToken, secret);
    } catch (e) {
      console.warn(`Unable to authenticate using auth token: ${authToken}`);
    }
  }

  return {
    authToken,
    claims,
  };
}
