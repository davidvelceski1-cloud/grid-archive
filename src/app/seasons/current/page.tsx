import { redirect } from "next/navigation";
import { getLatestYear } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CurrentSeason() {
  redirect(`/seasons/${await getLatestYear()}`);
}
