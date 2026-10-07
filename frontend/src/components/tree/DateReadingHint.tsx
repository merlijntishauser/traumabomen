import { useTranslation } from "react-i18next";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { dateReadingSentence } from "../../lib/dateReadingSentence";

interface DateReadingHintProps {
  id: string;
  text: string;
  personIds: string[];
  allPersons: Map<string, DecryptedPerson>;
}

/** Shows, as it is typed, where a free-text date will land on the timeline. */
export function DateReadingHint({ id, text, personIds, allPersons }: DateReadingHintProps) {
  const { t, i18n } = useTranslation();
  const people = personIds.flatMap((pid) => {
    const person = allPersons.get(pid);
    return person ? [{ name: person.name, birthYear: person.birth_year }] : [];
  });
  const sentence = dateReadingSentence(text, people, t, i18n?.language ?? "en");
  if (!sentence) return null;
  return (
    <p id={id} className="inspector-hint date-reading-hint" aria-live="polite">
      {sentence}
    </p>
  );
}
