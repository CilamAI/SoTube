/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input: { stage?: string }) {
    return {
      name: "sotube",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage ?? ""),
      home: "aws",
    };
  },
  async run() {
    const releases = new sst.aws.Bucket("ReleasesBucket", {
      access: "public",
    });

    const web = new sst.aws.StaticSite("SoTubeWeb", {
      path: "pages",
      index: "index.html",
      environment: {
        APP_NAME: "SoTube",
        APP_VERSION: "26.0.0",
        DOWNLOAD_URL: releases.name,
      },
    });

    const router = new sst.aws.Router("SoTubeRouter", {
      routes: {
        "/*": web.url,
      },
    });

    return {
      releases: releases.name,
      siteUrl: web.url,
      routerUrl: router.url,
    };
  },
});
