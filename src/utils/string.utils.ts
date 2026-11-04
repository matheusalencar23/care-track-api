export const normalizeForSearch = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

export const escapeLike = (value: string) => {
  return value.replace(/[\\%_]/g, "\\$&");
};
