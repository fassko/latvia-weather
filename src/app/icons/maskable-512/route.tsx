import { renderAppIcon } from "../app-icon";

export const dynamic = "force-static";

export function GET() {
  return renderAppIcon(512, true);
}
