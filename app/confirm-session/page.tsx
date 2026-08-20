import type { Metadata } from "next";
import ConfirmSessionClient from "./ConfirmSessionClient";

export const metadata: Metadata = {
  title: "Confirm your 1-1 thyroid session",
  robots: { index: false, follow: false },
};

export default function ConfirmSessionPage() {
  return <ConfirmSessionClient />;
}
