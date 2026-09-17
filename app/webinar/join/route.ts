import { redirectTo } from "../redirect-link";

// Read at request time, so a Worker variable change applies without a deploy.
export const dynamic = "force-dynamic";

export const GET = redirectTo("join");
