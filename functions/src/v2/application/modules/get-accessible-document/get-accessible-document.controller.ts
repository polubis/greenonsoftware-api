import { controller } from '../../utils/controller';
import { z } from 'zod';
import { Id, validators } from '../../utils/validators';
import { parse } from '../../utils/parse';
import type {
  DocumentModel,
  PermanentDocumentModel,
  PublicDocumentModel,
} from '../../../domain/models/document';
import { errors } from '../../utils/errors';
import { UserProfileModel } from '../../../domain/models/user-profile';

const payloadSchema = z.object({
  id: validators.id,
});

type DtoAuthorPart = { author: UserProfileModel | null };

type Dto =
  | (PublicDocumentModel & DtoAuthorPart)
  | (Required<PermanentDocumentModel> & DtoAuthorPart);

const getAccessibleDocumentController = controller<Dto>(
  async (rawPayload, { db }) => {
    const { id: documentId } = await parse(payloadSchema, rawPayload);
    const documentsSnap = await db.collection(`docs`).get();

    let foundDocumentEntry:
      | { document: PublicDocumentModel | PermanentDocumentModel; authorId: Id }
      | undefined;

    for (let i = 0; i < documentsSnap.docs.length; i++) {
      const documentsListSnap = documentsSnap.docs[i];

      const authorId = documentsListSnap.id;
      const documentsListData = documentsListSnap.data();
      const document = documentsListData[documentId] as
        | DocumentModel
        | undefined;

      if (
        document &&
        (document.visibility === `public` ||
          document.visibility === `permanent`)
      ) {
        foundDocumentEntry = {
          document,
          authorId,
        };
        break;
      }
    }

    if (!foundDocumentEntry) throw errors.notFound(`Cannot find document`);

    const userProfile = (
      await db
        .collection(`users-profiles`)
        .doc(foundDocumentEntry.authorId)
        .get()
    ).data() as UserProfileModel | undefined;

    const foundDocument = foundDocumentEntry.document;
    const author = userProfile ?? null;

    if (foundDocument.visibility === `permanent`) {
      const dto: Extract<Dto, { visibility: 'permanent' }> = {
        ...foundDocument,
        author,
        tags: foundDocument.tags ?? [],
      };

      return dto;
    }

    const dto: Extract<Dto, { visibility: 'public' }> = {
      ...foundDocument,
      author,
    };

    return dto;
  },
);

export { getAccessibleDocumentController };
