import type { Metadata } from "next";
import BookSessionClient from "./BookSessionClient";

export const metadata: Metadata = {
  title: "Pick your 1-1 thyroid session",
  robots: { index: false, follow: false },
};

export default function BookSessionPage() {
  return <BookSessionClient />;
}
