import { getSession } from "@/services/server/auth";
import { hasPermission } from "@/lib/permissions";
import { REVIEW_PERMISSION } from "@/lib/postReview";
import NoAccess from "@/components/ui/NoAccess";
import ReviewQueueClient from "@/components/review/ReviewQueueClient";

export default async function ReviewPage() {
  const session = await getSession();

  if (!hasPermission(session, REVIEW_PERMISSION)) {
    return <NoAccess message="Você não tem permissão para revisar posts." />;
  }

  return <ReviewQueueClient />;
}
