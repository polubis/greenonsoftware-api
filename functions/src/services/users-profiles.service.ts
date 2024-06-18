import { https } from 'firebase-functions';
import { errors } from '../core/errors';
import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { AuthService } from './auth.service';
import {
  IUserProfilePayload,
  UserProfilePayload,
} from '../payloads/user-profile.payload';
import {
  IUserProfileEntity,
  IUserProfileEntityAvatar,
  UserProfileEntity,
} from '../entities/user-profile.entity';
import { ImageEntity } from '../entities/img.entity';
import * as sharp from 'sharp';
import { IUserProfileDto } from '../dtos/users-profiles.dto';
import { Id } from '../entities/general';
import { DocAuthorDto } from '../dtos/docs.dto';
import { getBucket } from '../core/bucket';

const sizes = [
  {
    size: `lg`,
    h: 100,
    w: 100,
  },
  {
    size: `md`,
    h: 64,
    w: 64,
  },
  {
    size: `sm`,
    h: 32,
    w: 32,
  },
  {
    size: `tn`,
    h: 24,
    w: 24,
  },
] as const;

const createProfileDtoShape = (e: IUserProfileEntity): IUserProfileDto => ({
  id: e.id,
  avatar: e.avatar,
  displayName: e.displayName,
  bio: e.bio,
  blogUrl: e.blogUrl,
  fbUrl: e.fbUrl,
  githubUrl: e.githubUrl,
  twitterUrl: e.twitterUrl,
  linkedInUrl: e.linkedInUrl,
});

const rescaleAndUploadAvatars = async (uid: string, data: string) => {
  const avatar = ImageEntity(data);

  if (avatar.extension === `gif`) {
    throw errors.invalidArg(`Invalid extension of avatar`);
  }

  if (avatar.size > 4) {
    throw errors.invalidArg(`Invalid avatar size`);
  }

  const bucket = await getBucket();

  const rescalePromises: Promise<Buffer>[] = [];

  sizes.forEach(({ h, w }) => {
    rescalePromises.push(
      sharp(avatar.buffer).resize(w, h).webp({ quality: 70 }).toBuffer(),
    );
  });

  const rescaleBuffers = await Promise.all(rescalePromises);
  const savePromises: Promise<void>[] = [];
  const paths: string[] = [];

  sizes.forEach(({ size }, idx) => {
    const path = `${uid}/avatars/${size}`;
    const file = bucket.file(path);
    const buffer = rescaleBuffers[idx];

    savePromises.push(
      file.save(buffer, {
        contentType: `webp`,
      }),
    );
    paths.push(path);
  });

  await Promise.all(savePromises);

  return sizes.reduce<NonNullable<IUserProfileEntityAvatar>>(
    (acc, { size, w, h }, idx) => ({
      ...acc,
      [size]: {
        h,
        w,
        ext: `webp`,
        src: `https://firebasestorage.googleapis.com/v0/b/${
          bucket.name
        }/o/${encodeURIComponent(paths[idx])}?alt=media`,
        id: uuid(),
      },
    }),
    {} as NonNullable<IUserProfileEntityAvatar>,
  );
};

const checkIfDisplayNameIsTaken = async (
  uid: Id,
  displayName: IUserProfilePayload['displayName'],
  collection: admin.firestore.CollectionReference<admin.firestore.DocumentData>,
): Promise<void> => {
  if (displayName === null) return;

  const snapshot = await collection.get();

  if (snapshot.empty) return;

  snapshot.forEach((doc) => {
    if (doc.id === uid) return;

    const data = doc.data() as IUserProfileEntity;

    if (data.displayName === displayName) {
      throw errors.exists(`This display name is already taken by other user`);
    }
  });
};

type UsersProfilesLookup = Record<string, IUserProfileEntity>;

const UsersProfilesService = {
  getProfile: async (userId: Id): Promise<DocAuthorDto> => {
    const profile = await admin
      .firestore()
      .collection(`users-profiles`)
      .doc(userId)
      .get();

    if (!profile.exists) return null;
    const data = profile.data();

    if (!data) return null;

    return data as IUserProfileEntity;
  },
  getAll: async (): Promise<UsersProfilesLookup> => {
    const usersProfilesCollection = await admin
      .firestore()
      .collection(`users-profiles`)
      .get();

    const usersProfiles =
      usersProfilesCollection.docs.reduce<UsersProfilesLookup>(
        (acc, profile) => {
          acc[profile.id] = profile.data() as IUserProfileEntity;
          return acc;
        },
        {} as UsersProfilesLookup,
      );

    return usersProfiles;
  },
  getYour: async (
    context: https.CallableContext,
  ): Promise<IUserProfileDto | null> => {
    const auth = AuthService.authorize(context);
    const userProfilesCollection = admin
      .firestore()
      .collection(`users-profiles`);
    const userProfileDocument = await userProfilesCollection.doc(auth.uid);
    const userProfile = await userProfileDocument.get();

    if (!userProfile.exists) {
      return null;
    }

    const userProfileEntity = userProfile.data() as IUserProfileEntity;

    return createProfileDtoShape(userProfileEntity);
  },
  updateYour: async (
    payload: unknown,
    context: https.CallableContext,
  ): Promise<IUserProfileDto> => {
    const auth = AuthService.authorize(context);
    const userProfilePayload = UserProfilePayload(payload);
    const userProfilesCollection = admin
      .firestore()
      .collection(`users-profiles`);

    await checkIfDisplayNameIsTaken(
      auth.uid,
      userProfilePayload.displayName,
      userProfilesCollection,
    );

    const userProfileDocument = await userProfilesCollection.doc(auth.uid);
    const userProfile = await userProfileDocument.get();

    if (!userProfile.exists) {
      const cdate = new Date().toISOString();

      const userProfileNewEntity = UserProfileEntity({
        id: uuid(),
        cdate,
        avatar:
          userProfilePayload.avatar.type === `update`
            ? await rescaleAndUploadAvatars(
                auth.uid,
                userProfilePayload.avatar.data,
              )
            : null,
        mdate: cdate,
        displayName: userProfilePayload.displayName,
        bio: userProfilePayload.bio,
        blogUrl: userProfilePayload.blogUrl,
        fbUrl: userProfilePayload.fbUrl,
        githubUrl: userProfilePayload.githubUrl,
        twitterUrl: userProfilePayload.twitterUrl,
        linkedInUrl: userProfilePayload.linkedInUrl,
      });

      await userProfileDocument.set(userProfileNewEntity);

      return createProfileDtoShape(userProfileNewEntity);
    }

    const currentUserProfileEntity = userProfile.data();

    if (!UserProfileEntity.is(currentUserProfileEntity)) {
      throw errors.invalidSchema(UserProfileEntity.name);
    }

    if (userProfilePayload.avatar.type === `remove`) {
      const bucket = await getBucket();
      const deletePromises = sizes.map(({ size }) =>
        bucket.file(`${auth.uid}/avatars/${size}`).delete(),
      );

      await Promise.all(deletePromises);
    }

    const userProfileNewEntity = UserProfileEntity({
      id: currentUserProfileEntity.id,
      cdate: currentUserProfileEntity.cdate,
      mdate: new Date().toISOString(),
      avatar:
        userProfilePayload.avatar.type === `noop`
          ? currentUserProfileEntity.avatar
          : userProfilePayload.avatar.type === `remove`
          ? null
          : await rescaleAndUploadAvatars(
              auth.uid,
              userProfilePayload.avatar.data,
            ),
      displayName: userProfilePayload.displayName,
      bio: userProfilePayload.bio,
      blogUrl: userProfilePayload.blogUrl,
      fbUrl: userProfilePayload.fbUrl,
      githubUrl: userProfilePayload.githubUrl,
      twitterUrl: userProfilePayload.twitterUrl,
      linkedInUrl: userProfilePayload.linkedInUrl,
    });

    await userProfileDocument.set(userProfileNewEntity);

    return createProfileDtoShape(userProfileNewEntity);
  },
};

export { UsersProfilesService };
