import { UpdateDocPayload } from '../payloads/docs.payload';
import { errors } from '../core/errors';
import { DocEntity, DocEntityField } from '../entities/doc.entity';
import {
  GetPermanentDocsDto,
  UpdateDocPermanentDto,
  UpdateDocPrivateDto,
  UpdateDocPublicDto,
} from '../dtos/docs.dto';
import { Doc, getAllDocs } from '../core/doc';
import { Id } from '../entities/general';
import { DocsRepository } from '../repositories/docs.repository';
import * as admin from 'firebase-admin';
import { UsersProfilesService } from './users-profiles.service';

export const DocsService = {
  getAllPermanent: async (): Promise<GetPermanentDocsDto> => {
    try {
      const [docsCollection, usersProfiles] = await Promise.all([
        admin.firestore().collection(`docs`).get(),
        UsersProfilesService.getAll(),
      ]);
      const docs = docsCollection.docs;

      return docs
        .reduce<GetPermanentDocsDto>((acc, doc) => {
          Object.entries(doc.data()).forEach(
            ([id, field]: [string, DocEntityField]) => {
              if (field.visibility === `permanent`) {
                acc.push({
                  id,
                  cdate: field.cdate,
                  mdate: field.mdate,
                  name: field.name,
                  description: field.description,
                  path: field.path,
                  code: field.code,
                  visibility: field.visibility,
                  tags: field.tags ?? [],
                  author: usersProfiles[doc.id] ?? null,
                });
              }
            },
          );

          return acc;
        }, [] as GetPermanentDocsDto)
        .sort((prev, curr) => {
          if (prev.cdate > curr.cdate) return -1;
          if (prev.cdate === curr.cdate) return 0;
          return 1;
        });
    } catch (err) {
      throw errors.internal(`Server error`);
    }
  },
  update: async (uid: Id, payload: UpdateDocPayload) => {
    const name = Doc.createName(payload.name, payload.visibility);
    const docsRepo = DocsRepository(uid);

    const docs = await docsRepo.getMy();

    if (!docs.exists) {
      throw errors.notFound();
    }

    const mdate = new Date().toISOString();
    const fields = docs.data() as DocEntity;
    const doc = fields[payload.id];

    if (!doc) {
      throw errors.notFound();
    }

    if (doc.mdate !== payload.mdate) {
      throw errors.outOfDateEntry(
        `You cannot edit this document. You've changed it on another device.`,
      );
    }

    if (payload.visibility === `public` || payload.visibility === `private`) {
      const alreadyExists = Object.entries(fields).some(
        ([id, field]) => id !== payload.id && field.name === name,
      );

      if (alreadyExists) {
        throw errors.exists(`Document with provided name already exist`);
      }
    }

    switch (payload.visibility) {
      case `public`: {
        const dto: UpdateDocPublicDto = {
          cdate: doc.cdate,
          mdate,
          visibility: payload.visibility,
          code: payload.code,
          name,
          id: payload.id,
        };

        const docEntity: DocEntity = {
          [payload.id]: dto,
        };

        await docsRepo.update(docEntity);

        return dto;
      }
      case `private`: {
        const dto: UpdateDocPrivateDto = {
          cdate: doc.cdate,
          mdate,
          visibility: payload.visibility,
          code: payload.code,
          name,
          id: payload.id,
        };

        const docEntity: DocEntity = {
          [payload.id]: dto,
        };

        await docsRepo.update(docEntity);

        return dto;
      }
      case `permanent`: {
        const tags = Doc.createTags(payload.tags);

        const dto: UpdateDocPermanentDto = {
          cdate: doc.cdate,
          mdate,
          visibility: payload.visibility,
          code: payload.code,
          name,
          id: payload.id,
          path: Doc.createPath(name, payload.visibility),
          description: Doc.createDescription(payload.description),
          tags,
        };

        const alreadyExists =
          (await getAllDocs()).filter(
            (doc) =>
              doc.id !== payload.id &&
              doc.visibility === `permanent` &&
              doc.name === dto.name,
          ).length > 0;

        if (alreadyExists) {
          throw errors.exists(
            `Document with provided name already exists, please change name`,
          );
        }

        const docEntity: DocEntity = {
          [payload.id]: dto,
        };

        await docsRepo.update(docEntity);

        return dto;
      }
      default: {
        throw errors.invalidArg(`Wrong visiblity value`);
      }
    }
  },
};
