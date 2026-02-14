import { useParams } from "react-router-dom";
import { compactToUuid, isUuid } from "../lib/compactId";

/** Extract tree UUID from route params, decoding compact IDs. */
export function useTreeId(): string | undefined {
  const { id } = useParams<{ id: string }>();
  if (!id) return undefined;
  if (isUuid(id)) return id;
  try {
    return compactToUuid(id);
  } catch {
    return undefined;
  }
}
