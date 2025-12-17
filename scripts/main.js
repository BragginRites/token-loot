'use strict';

import { setupInitHook } from './hooks/init.js';
import { setupCreateTokenHook } from './hooks/createToken.js';
import { setupPreCreateTokenHook } from './hooks/preCreateToken.js';
import { setupRenderActorDirectoryHook } from './hooks/renderActorDirectory.js';
import { setupBG3Compat } from './compat/bg3/index.js';

// Initialize Hooks
setupInitHook();
setupCreateTokenHook();
setupPreCreateTokenHook();
setupRenderActorDirectoryHook();

// Setup Compatibility Layers
// BG3 compat runs immediately but checks for active module availability.
// It hooks nothing itself, just patches the API if module is present.
// It should probably run during 'ready' hook, but init.js handles ready.
// Let's wrap it in a ready hook here to be safe, or assume init.js handles it?
// init.js does NOT import setupBG3Compat.
// So we should call it here.
Hooks.once('ready', () => {
	setupBG3Compat();
});
