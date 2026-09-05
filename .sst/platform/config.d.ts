declare global {
  interface AppInput {
    stage?: string;
  }

  interface AppReturn {
    name: string;
    removal?: "retain" | "remove" | "retain-all";
    protect?: boolean;
    home?: "aws" | "cloudflare";
    providers?: Record<string, any>;
  }

  interface SSTConfig {
    app(input: AppInput): AppReturn;
    run(): Promise<Record<string, any> | void> | Record<string, any> | void;
  }

  function $config(config: SSTConfig): SSTConfig;

  namespace sst {
    namespace aws {
      class Bucket {
        constructor(name: string, args?: { access?: "public" | "private"; public?: boolean });
        name: any;
        arn: any;
      }

      class StaticSite {
        constructor(name: string, args?: { path: string; index?: string; domain?: any; environment?: Record<string, any> });
        url: any;
      }

      class Router {
        constructor(name: string, args?: { routes: Record<string, any> });
        url: any;
      }

      class Function {
        constructor(name: string, args?: { handler: string; url?: boolean });
        url: any;
      }
    }
  }
}

export {};
