import type { Name, Path } from '../entities/general';

const docValidators = {
  name: (name: unknown): name is Name =>
    typeof name === `string` &&
    name.length === name.trim().length &&
    name.length >= 2 &&
    name.length <= 100 &&
    /^[a-zA-Z0-9]+(?:\s[a-zA-Z0-9]+)*$/.test(name.trim()),
  path: (name: unknown): name is Path => {
    if (typeof name !== `string`) {
      return false;
    }

    const path = name.trim().replace(/ /g, `-`).toLowerCase();

    return /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+){0,9}-[a-zA-Z0-9]+$/.test(path);
  },
};

export { docValidators };
