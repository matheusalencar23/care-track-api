import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
  ip: string | undefined;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = (
  context: RequestContext,
  callback: () => void,
) => storage.run(context, callback);

export const getRequestContext = () => storage.getStore();

export const getRequestId = () => storage.getStore()?.requestId;
