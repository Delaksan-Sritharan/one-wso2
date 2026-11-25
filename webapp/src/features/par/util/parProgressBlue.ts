// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import type { Theme } from "@wso2/oxygen-ui";

// On a light surface Cobalt reads too sharp, so the light-mode blue is Azure (dark mode's) deepened with
// Midnight Ink: the same blue, calmer, and 5.2:1 on the tracker's tab rail.
const LIGHT_BLUE = "#2C62B8";

/** The colour of something under way (an In progress step, a Requested 360° request). Choreo Labs' info
 * colour is ink in light and white in dark, so this takes the theme's own blue, the one Oxygen draws focus
 * rings with (Azure in dark), with a calmer blue in light; a theme without one keeps its info colour.
 * `colour` follows the light/dark switch; `light` is the one to apply in the light scheme. */
export function progressBlue(theme: Theme): { colour: string; light: string } {
  type WithFocusRing = Theme["palette"] & { Button?: { focusRing?: string } };
  const vars = (theme.vars ?? theme).palette as WithFocusRing;
  const ring = vars.Button?.focusRing;
  if (!ring || !(theme.palette as WithFocusRing).Button?.focusRing) {
    return { colour: vars.info.main, light: theme.palette.info.main };
  }
  return { colour: ring, light: LIGHT_BLUE };
}
