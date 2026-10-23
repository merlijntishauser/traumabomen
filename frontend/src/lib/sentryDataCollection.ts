import type { BrowserOptions } from "@sentry/react";

type DataCollection = NonNullable<BrowserOptions["dataCollection"]>;

/**
 * Sentry collects nothing about the user or their requests. Since Sentry 11
 * every category defaults to on, so each one is switched off here rather than
 * left to a default; login request bodies carry the password.
 */
export const SENTRY_DATA_COLLECTION: Required<DataCollection> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};
