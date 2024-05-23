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
import { IUserProfileEntity } from '../entities/user-profile.entity';

export const DocsService = {
  getAllPermanent: async (): Promise<GetPermanentDocsDto> => {
    try {
      const [allDocsResponse, allUsersProfilesResponse] = await Promise.all([
        admin.firestore().collection(`docs`).get(),
        admin.firestore().collection(`users-profiles`).get(),
      ]);

      const allDocs = allDocsResponse.docs;
      const allUsersProfiles = allUsersProfilesResponse.docs.reduce(
        (acc, doc) => {
          const userId = doc.id;
          const profileEntity = doc.data();

          acc[userId] = profileEntity as IUserProfileEntity;

          return acc;
        },
        {} as Record<Id, IUserProfileEntity>,
      );

      return allDocs
        .reduce<GetPermanentDocsDto>((acc, doc) => {
          Object.entries(doc.data()).forEach(
            ([id, field]: [string, DocEntityField]) => {
              const userId = doc.id;

              if (field.visibility === `permanent`) {
                acc.push({
                  id,
                  cdate: field.cdate,
                  mdate: field.mdate,
                  code: field.code,
                  name: field.name,
                  visibility: field.visibility,
                  description: field.description,
                  path: field.path,
                  tags: field.tags ?? [],
                  author: allUsersProfiles[userId] ?? null,
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
