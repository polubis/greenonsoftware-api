import { https } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { DocsService } from './services/docs.service';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';
import { UploadImagePayload } from './payloads/images.payload';
import { UsersProfilesService } from './services/users-profiles.service';
import { BackupsService } from './services/backups.service';
import {
  CreateBackupPayload,
  UseBackupPayload,
} from './payloads/backup.payload';
import { ProjectId } from './models/project-id';
import { Endpoint } from './libs/framework/endpoint';
import { Job } from './libs/framework/job';
import { isDev } from './core/env-checks';
import { updateDocumentCodeController } from './v2/application/modules/update-document-code/update-document-code.controller';
import { rateDocumentController } from './v2/application/modules/rate-document/rate-document.controller';
import { deleteDocumentController } from './v2/application/modules/delete-document/delete-document.controller';
import { getPermanentDocumentsController } from './v2/application/modules/get-permanent-documents/get-permanent-documents.controller';
import { getAccessibleDocumentController } from './v2/application/modules/get-accessible-document/get-accessible-document.controller';
import { createDocumentController } from './v2/application/modules/create-document/create-document.controller';
import { getYourDocumentsController } from './v2/application/modules/get-your-documents/get-your-documents.controller';

const app = admin.initializeApp();
const projectId = ProjectId(app.options.projectId);
const db = app.firestore();
// @TODO: Use admin.auth() once and inject it to controllers.

const { onCall } = https;

export const updateDoc = onCall(async (payload, context) => {
  const user = AuthService.authorize(context);
  return DocsService.update(user.uid, payload);
});

export const uploadImage = onCall(
  async (payload: UploadImagePayload, context) => {
    return await UsersService.uploadImage(payload, context);
  },
);

export const updateYourUserProfile = onCall(
  async (payload: unknown, context) => {
    return await UsersProfilesService.updateYour(payload, context);
  },
);

export const getYourUserProfile = onCall(async (_, context) => {
  return await UsersProfilesService.getYour(context);
});

export const useBackup = Endpoint<void>(async (payload) => {
  await BackupsService.use(projectId, UseBackupPayload(payload));
});

export const createBackup = Endpoint<void>(async (payload) => {
  await BackupsService.create(projectId, CreateBackupPayload(payload));
});

export const autoCreateBackup = Job(`every sunday 23:59`, async () => {
  if (isDev(projectId)) return;

  await BackupsService.create(
    ProjectId(app.options.projectId),
    CreateBackupPayload({
      token: process.env.BACKUP_TOKEN,
    }),
  );
});

export const updateDocumentCode = updateDocumentCodeController(db);
export const rateDocument = rateDocumentController(db);
export const deleteDocument = deleteDocumentController(db);
export const getPermanentDocuments = getPermanentDocumentsController(db);
export const getAccessibleDocument = getAccessibleDocumentController(db);
export const createDocument = createDocumentController(db);
export const getYourDocuments = getYourDocumentsController(db);
