/**
 * Preview-only stand-in for the WebExtension API, so the dashboard and popup
 * can run in a normal tab (design work, screenshots, store listing assets).
 */
import { fakeBrowser } from '@webext-core/fake-browser';

const shim = fakeBrowser as typeof fakeBrowser & Record<string, unknown>;
shim.runtime.getManifest = (() => ({ manifest_version: 3, name: 'twtdash', version: '1.0.0' })) as typeof shim.runtime.getManifest;

export const browser = shim;
export default shim;
