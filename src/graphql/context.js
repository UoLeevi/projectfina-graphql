import jwt from 'jsonwebtoken';

export async function context({ req }) {
  const authorization = req.headers['authorization'] || null;
  const authToken = (authorization && authorization.startsWith('Bearer ')
    ? authorization.substring(7)
    : null);

  let claims = null;

  if (authToken) {
    try {
      // TODO verify token
      claims = jwt.decode(authToken); // jwt.verify(authToken, secret);
    } catch (e) {
      console.warn(`Unable to authenticate using auth token: ${authToken}`);
    }
  }

  return {
    authToken,
    claims,
  };
}
