import HouseholdBoard from "../components/household-board";

export default function Home() {
  return <HouseholdBoard isPreview={process.env.VERCEL_ENV === "preview"} />;
}
