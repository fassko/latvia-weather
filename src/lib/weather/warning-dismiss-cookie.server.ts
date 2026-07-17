import { cookies } from "next/headers";
import {
  WARNING_DISMISS_COOKIE_NAME,
  parseDismissedWarningIds,
} from "./warning-dismiss-cookie";

export async function getDismissedWarningIds(): Promise<string[]> {
  const cookieStore = await cookies();
  return parseDismissedWarningIds(
    cookieStore.get(WARNING_DISMISS_COOKIE_NAME)?.value,
  );
}
