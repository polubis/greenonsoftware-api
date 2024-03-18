import { Blob } from '../entities/general';
import {
  IMAGE_EXTENSIONS,
  ImageContentType,
  ImageExtension,
} from '../entities/image.entity';
import { imageValidators } from '../validation/image';
import { errors } from './errors';

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
  blob: Blob;
  extension: ImageExtension;
  contentType: ImageContentType;
} => {
  if (!imageValidators.format(image)) {
    throw errors.invalidArg(`Wrong image data type`);
  }

  const { blob, contentType, extension } = Image.decode(image);

  if (!imageValidators.extension(extension)) {
    throw errors.invalidArg(
      `Unsupported image format, use supported one: ${IMAGE_EXTENSIONS.join(
        `, `,
      )}`,
    );
  }

  return {
    blob,
    extension,
    contentType: contentType as ImageContentType,
  };
};

export { Image };
