import { https } from 'firebase-functions';
import { errors } from '../../../libs/framework/errors';

const isAuthenticated = (context: https.CallableContext) => {
  if (!context.auth) {
    throw errors.unauthenticated(`UNAUTHENTICATED`, `No permissions`);
  }

  return context.auth;
};

export { isAuthenticated };