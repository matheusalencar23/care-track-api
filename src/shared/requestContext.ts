import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = (
  context: RequestContext,
  callback: () => void,
) => storage.run(context, callback);

export const getRequestId = () => storage.getStore()?.requestId;
