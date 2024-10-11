import { Blob } from '../entities/general';
import {
  IMAGE_EXTENSIONS,
  ImageContentType,
  ImageExtension,
} from '../entities/image.entity';
import { errors } from '../v2/application/utils/errors';
import { imageValidators } from '../validation/image';

const Image = () => {};

// Example: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE..
Image.decode = (
  image: string,
): { blob: Blob; contentType: string; extension: string } => {
  const [meta] = image.split(`,`);
  const contentType = meta.split(`:`)[1].split(`;`)[0];
  const extension = contentType.replace(`image/`, ``);
  const blob = image.replace(/^data:image\/\w+;base64,/, ``);

  return {
    blob,
    contentType,
    extension,
  };
};

Image.create = (
  image: unknown,
): {
  extension: ImageExtension;
  contentType: ImageContentType;
  buffer: Buffer;
} => {
  if (!imageValidators.format(image)) {
    throw errors.badRequest(`Wrong image data type`);
  }

  const { blob, contentType, extension } = Image.decode(image);

  if (!imageValidators.extension(extension)) {
    throw errors.badRequest(
      `Unsupported image format, use supported one: ${IMAGE_EXTENSIONS.join(
        `, `,
      )}`,
    );
  }

  const buffer = Buffer.from(blob, `base64`);

  if (!imageValidators.size(buffer)) {
    throw errors.badRequest(
      `Max image size is ${imageValidators.limitInMegabytes} megabytes (MB)`,
    );
  }

  return {
    extension,
    contentType: contentType as ImageContentType,
    buffer,
  };
};

export { Image };
