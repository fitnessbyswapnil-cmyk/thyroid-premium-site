/**
 * GET /webinar/links — which of the button targets are set right now.
 *
 * The thank-you page is static, but the Community and Starter Kit links can be
 * set as Worker variables without a deploy, so the page asks here before it
 * shows those buttons. Booleans only: the targets themselves stay behind the
 * /webinar/group and /webinar/starter-kit redirects.
 */
import { NextResponse } from "next/server";
import { resolveWebinarLink } from "@/lib/webinar";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      group: resolveWebinarLink("group", process.env) !== null,
      starterKit: resolveWebinarLink("starter-kit", process.env) !== null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
