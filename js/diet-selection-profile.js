import { IS_VIVI_DIET_PROFILE } from "./diet-profile.js";
import * as vini from "./vini-diet-selection.js";
import * as vivi from "./vivi-diet-selection.js";

const active = IS_VIVI_DIET_PROFILE ? vivi : vini;

export const VINI_MEAL_PRESETS = active.VIVI_MEAL_PRESETS || active.VINI_MEAL_PRESETS;
export const isViniMealPresetApplied = active.isViviMealPresetApplied || active.isViniMealPresetApplied;
export const setViniFoodChecked = active.setViviFoodChecked || active.setViniFoodChecked;
export const toggleViniMealPreset = active.toggleViviMealPreset || active.toggleViniMealPreset;
export const toggleViniFoodQuantity = active.toggleViviFoodQuantity || active.toggleViniFoodQuantity;
