export const GROUP_COUNT = 33;
export const KNOWN_GROUPS = Object.freeze(
  Array.from({ length: GROUP_COUNT }, (_, index) => String(index + 1)),
);

export function normalizeSearchText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("zh-CN");
}

export function normalizeGroupNumber(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  if (!/^\d{1,2}$/.test(normalized)) return null;

  const groupNumber = Number(normalized);
  if (groupNumber < 1 || groupNumber > GROUP_COUNT) return null;
  return String(groupNumber);
}

export function matchesSearch(pet, query) {
  if (!query) return true;
  return normalizeSearchText([
    pet.petName,
    pet.nickname,
    pet.githubLogin,
    pet.group,
    pet.description,
    pet.issueNumber,
    pet.kind === "example" ? "示例" : "学员作品",
  ].join(" ")).includes(normalizeSearchText(query));
}

export function matchesGroup(pet, selectedGroup) {
  if (!String(selectedGroup ?? "").trim()) return true;
  const groupNumber = normalizeGroupNumber(selectedGroup);
  return groupNumber !== null && normalizeGroupNumber(pet.group) === groupNumber;
}
