import { createFileRoute } from "@tanstack/react-router";
import { BadgeX } from "lucide-react";
import { PlanPage } from "@/components/app/PlanPage";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Choose Your Plan — Dish Discovery" },
      {
        name: "description",
        content: "Sample ad-free membership plans for Dish Discovery food explorers.",
      },
      { property: "og:title", content: "Choose Your Plan — Dish Discovery" },
      {
        property: "og:description",
        content: "Sample ad-free membership plans for Dish Discovery food explorers.",
      },
    ],
  }),
  component: Plans,
});

function Plans() {
  return (
    <PlanPage
      heading="Choose Your Plan"
      subtitle="Unlock premium features and enjoy a better experience."
      plans={[
        {
          icon: BadgeX,
          title: "Saved dishes + Remove Ads",
          description: "Save your favourite dishes and browse without ads",
          original: 399,
          price: 99,
          period: "month",
          bestValue: false,
        },
        {
          icon: BadgeX,
          title: "Saved dishes + Remove Ads",
          description: "Save your favourite dishes and browse without ads",
          original: 4788,
          price: 999,
          period: "year",
          bestValue: true,
        },
      ]}
    />
  );
}
