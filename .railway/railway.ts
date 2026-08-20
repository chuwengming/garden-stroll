import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("chuwengming/garden-stroll"),
    build: "npm run build",
    start: "next start",
  });

  return project("Garden_Stroll", {
    resources: [web],
  });
});
