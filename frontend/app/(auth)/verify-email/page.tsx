import { Suspense } from "react";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyEmail /></Suspense>;
}
