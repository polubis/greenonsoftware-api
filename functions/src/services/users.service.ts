import { https } from 'firebase-functions';
import { errors } from '../core/errors';
import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { UploadImagePayload } from '../payloads/images.payload';
import { Image } from '../core/image';
import { UploadImageDto } from '../dtos/image.dto';
import { AuthService } from './auth.service';

const UsersService = {
  uploadImage: async (
    payload: UploadImagePayload,
    context: https.CallableContext,
  ): Promise<UploadImageDto> => {
    AuthService.authorize(context);

    const { blob, extension, contentType } = Image.create(payload.image);
    const storage = admin.storage();
    const bucket = storage.bucket();
    const [bucketExists] = await bucket.exists();

    if (!bucketExists) {
      throw errors.internal(`Cannot find bucket for images`);
    }

    const id = `${uuid()}.${extension}`;
    const file = bucket.file(id);

    await file.save(Buffer.from(blob, `base64`), {
      contentType,
      public: true,
    });

    return {
      extension,
      contentType,
      url: ``,
      id,
    };
  },
};

export { UsersService };
