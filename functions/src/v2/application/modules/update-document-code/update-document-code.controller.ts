import { errors } from '../../../libs/framework/errors';
import { protectedController } from '../../../libs/framework/controller';
import { z } from 'zod';
import { validators } from '../../utils/validators';
import { parse } from '../../../libs/framework/parse';
import { collections } from '../../database/collections';
import { DocumentModel, DocumentsModel } from '../../../domain/models/document';

const payloadSchema = z.object({
  id: validators.id,
  mdate: validators.date,
  code: z.string(),
});

type Payload = z.infer<typeof payloadSchema>;

const commands = {
  parsePayload: (rawPayload: unknown) => parse(payloadSchema, rawPayload),
  updateDocument: async ({
    uid,
    payload,
    documents,
  }: {
    uid: string;
    payload: Payload;
    documents: DocumentsModel;
  }) => {
    const document = documents[payload.id] as DocumentModel | undefined;

    if (!document) {
      throw errors.notFound(`Document not found`);
    }

    if (payload.mdate !== document.mdate) {
      throw errors.outOfDate(`The document has been already changed`);
    }

    await collections
      .documents()
      .doc(uid)
      .update({
        [payload.id]: {
          ...document,
          code: payload.code,
        },
      });
  },
};

const queries = {
  getUserDocument: async (uid: string) => {
    const snapshot = await collections.documents().doc(uid).get();

    if (!snapshot.exists)
      throw errors.notFound(`Documents collection not found`);

    const documents = snapshot.data() as DocumentsModel | undefined;

    if (!documents) throw errors.notFound(`Document data not found`);

    return documents;
  },
};

const updateDocumentCodeController = protectedController(
  async (rawPayload, { uid }) => {
    const payload = await commands.parsePayload(rawPayload);
    const documents = await queries.getUserDocument(uid);
    await commands.updateDocument({
      documents,
      uid,
      payload,
    });
  },
);

export { updateDocumentCodeController };
