'use strict';

// saveWorldRuleSet now handled by GroupManagerState

/**
 * Manages automatic saving of group manager state with debouncing
 */
export class AutoSaveManager {
    constructor(state) {
        this.state = state;
        this.saveTimer = null;
    }

    /**
     * Save immediately
     */
    save() {
        this.state.save();
    }

    /**
     * Save with a debounced delay (400ms)
     */
    saveDeferred() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.save(), 400);
    }

    /**
     * Cancel any pending deferred save
     */
    cancelPendingSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }
}
